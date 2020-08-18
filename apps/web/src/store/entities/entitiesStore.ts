import { observable, action, computed, transaction, observe } from 'mobx';
import { generatePath } from 'react-router-dom';
import mapValues from 'lodash/mapValues';
import pickBy from 'lodash/pickBy';
import uniqBy from 'lodash/uniqBy';

import { ErrorsStore, IExtractedFlatErrors } from 'store';
import { EMPTY_ERRORS } from 'store/errors';
import { fetch, getPageOffset, IFetchInit } from 'utils';

import {
  TSortDir,
  TEntitiesCounters,
  TActionFetchMethod,
  TColumnConfig,
  IEntitiesColumnsConfig,
  IEntitiesColumnsState,
} from './types';

class EntitiesStore<T extends { id: string }, FS extends { all: string }, SC = keyof T> {
  constructor(state: IEntitiesColumnsState<SC>) {
    this.urlMatch = state.urlMatch;
    this.entitiesUrl = state.entitiesUrl;
    this.entitiesField = state.entitiesField;
    this.subField = state.subField;
    this.counters = state.counters;
    this.filterByStatus = 'all';
    this.isPending = false;
    this.isLoadMorePending = false;
    this.sortDir = state.sortDir || 'descending';
    this.sortColumn = state.sortColumn;
    this.columnsOrder = state.columnsOrder;
    this.columnsConfig = state.columnsConfig;
    this.translationPrefix = state.translationPrefix;
    this.perPage = 50;

    this.defaultCounters = state.counters;
    this.defaultSortColumn = state.sortColumn;
    this.defaultSortDir = state.sortDir || 'descending';

    observe(this, 'entities', () => this.resetSelectedEntities());
  }

  @observable entities: T[] = [];
  @observable filterByStatus: keyof FS;
  @observable offset = 0;
  @observable isPending: boolean;
  @observable isLoadMorePending: boolean;
  @observable sortDir: TSortDir;
  @observable sortColumn: SC;
  @observable columnsOrder: SC[];
  @observable columnsConfig: TColumnConfig<SC>;
  @observable perPage: number;
  @observable selectedEntities: Record<string, boolean> = {};
  @observable entityActionPending: Record<string, boolean> = {};
  @observable searchString = '';
  @observable updateEntitiesErrors = EMPTY_ERRORS;

  @observable.struct counters: TEntitiesCounters;

  urlMatch: string;
  entitiesUrl: string;
  entitiesField: string;
  subField?: SC;
  translationPrefix: string | undefined;
  abortController: AbortController | null = null;

  defaultCounters: TEntitiesCounters;
  defaultSortColumn: SC;
  defaultSortDir: TSortDir;

  /*
   * data fetching
   */

  @action setPending(state: boolean): void {
    this.isPending = state;
  }

  @action setLoadMorePending(state: boolean): void {
    this.isLoadMorePending = state;
  }

  @action setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  @action setEntities(entities: T[]): void {
    this.entities = entities;
  }

  @action setUpdateEntitiesErrors(errors: IExtractedFlatErrors): void {
    this.updateEntitiesErrors = errors;
  }

  @action resetUpdateEntitiesErrors(): void {
    this.updateEntitiesErrors = EMPTY_ERRORS;
  }

  getQueryParams(offset: number): Record<string, string> {
    return {
      offset: String(offset),
      limit: String(this.perPage),
      searchTerm: String(this.searchString),
      sortField: String(this.sortColumn),
      sortDirection: String(this.sortDir),
    };
  }

  async getEntities(
    params: IFetchInit,
    method = 'get',
  ): Promise<{ counters: TEntitiesCounters; entities: T[] } | void> {
    try {
      const response = await fetch(this.entitiesUrl, {
        method,
        ...params,
      });

      const { status, ok } = response;

      if (ok && status === 200) {
        const data = await response.json();
        const counters = this.extractCounters(data);
        //TODO: change to object
        const entities = data || [];

        return { entities, counters };
      }

      const errors = await ErrorsStore.extractError(response);
      this.setUpdateEntitiesErrors(errors);
    } catch (error) {
      ErrorsStore.showTempError(error);
    }
  }

  async updateEntities(
    filterStatus: keyof FS = 'all',
    offset = 0,
    sortColumn: SC = this.defaultSortColumn,
    sortDir: TSortDir = this.defaultSortDir,
    searchString = '',
  ): Promise<void> {
    this.abortController?.abort();

    const currentAbortController = new AbortController();

    transaction(() => {
      this.setAbortController(currentAbortController);
      this.setPending(true);
      this.setFilterByStatus(filterStatus);
      this.setOffset(offset);
      this.setSearchString(searchString);
      this.resetUpdateEntitiesErrors();

      if (sortColumn) this.setSortColumn(sortColumn);
      if (sortDir) this.setSortDir(sortDir);
    });

    const result = await this.getEntities({
      queryParams: this.getQueryParams(offset),
      signal: currentAbortController.signal,
    });

    if (result) {
      const { counters, entities } = result;

      this.setEntitiesCounters(counters);
      this.setEntities(entities);
    }

    if (this.abortController === currentAbortController) {
      this.setPending(false);
    }
  }

  async loadNextPage(): Promise<void> {
    if (this.isPending) return;

    this.setLoadMorePending(true);

    const offset = this.entities.length;
    const queryParams = this.getQueryParams(offset);
    const result = await this.getEntities({ queryParams });

    if (result) {
      const { counters, entities } = result;

      this.setEntitiesCounters(counters);
      this.mergeEntities(entities);
    }

    this.setLoadMorePending(false);
  }

  mergeEntities(additionalEntities: T[]): void {
    const merged = uniqBy([...this.entities, ...additionalEntities], ({ id }) => id);
    this.setEntities(merged);
  }

  updateEntitiesInPlace(): void {
    this.updateEntities(this.filterByStatus, this.offset, this.sortColumn, this.sortDir, this.searchString);
  }

  resetEntities(): void {
    this.setEntities([]);
    this.abortController?.abort();
  }

  /*
   * counters
   */

  @action setEntitiesCounters(counters: TEntitiesCounters): void {
    this.counters = counters;
  }

  @action resetEntitiesCounters(): void {
    this.counters = this.defaultCounters;
  }

  async updateCounters(): Promise<void> {
    try {
      const response = await fetch(this.entitiesUrl, {
        method: 'get',
        queryParams: {
          offset: '0',
          limit: '0',
        },
      });

      if (response.status === 200) {
        const data = await response.json();
        const counters = this.extractCounters(data);

        // do not save found*, they always = 0 and break pagination
        const filtered = pickBy(counters, (value, counterName) => {
          return !counterName.startsWith('found');
        });

        this.setEntitiesCounters({ ...this.counters, ...filtered });
      }
    } catch (error) {
      ErrorsStore.showTempError(error);
    }
  }

  extractCounters(data: Record<string, unknown>): TEntitiesCounters {
    return mapValues(this.counters, (value, key) => Number(data[key]) || 0);
  }

  /*
   * pagination
   */

  @action setOffset(offset: number): void {
    this.offset = offset;
  }

  @action setPerPage(amount: number): void {
    this.perPage = amount;
  }

  @computed get totalRecords(): number {
    const { found = null } = this.counters;
    if (found !== null) return found;

    const filterStatus = String(this.filterByStatus);
    if (filterStatus === 'all') return this.counters.total || 0;

    return this.counters[filterStatus] || 0;
  }

  @computed get commonPathParams(): Record<string, string> {
    return {};
  }

  @computed get pageUrlPath(): string {
    return this.getPageUrlPath(String(this.filterByStatus));
  }

  @computed get getPageUrl(): (page: number) => string {
    const perPage = this.perPage;
    const path = this.pageUrlPath;
    const common = this.commonUrlParams;

    return (page: number): string => {
      const offset = String(getPageOffset(page, perPage));
      const urlParams = this.convertToUrlParams({ ...common, offset });

      return `${path}?${urlParams}`;
    };
  }

  @computed get getStatusUrl(): (filterStatus: string) => string {
    const common = this.commonUrlParams;

    return (filterStatus: string): string => {
      const path = this.getPageUrlPath(filterStatus);
      const urlParams = this.convertToUrlParams({ ...common });

      return `${path}?${urlParams}`;
    };
  }

  getPageUrlPath(filterStatus: string): string {
    const params = filterStatus === 'all' ? this.commonPathParams : { ...this.commonPathParams, status: filterStatus };
    const path = generatePath(this.urlMatch || '', params);

    return path;
  }

  /*
   * sort
   */

  @action setSortColumn(sortColumn: SC): void {
    this.sortColumn = sortColumn;
  }

  @action setSortDir(sortDir: TSortDir): void {
    this.sortDir = sortDir;
  }

  getSortUrl(column: SC): string | null {
    const { sortable = false } = this.getColumnConfig(column) || {};
    if (!sortable) return null;

    const path = this.pageUrlPath;
    const isSameColumn = column === this.sortColumn;

    const sortField = String(column);
    const sortDir = isSameColumn && this.sortDir === 'descending' ? 'ascending' : 'descending';

    const urlParams = this.convertToUrlParams({ ...this.commonUrlParams, sortField, sortDir });

    return `${path}?${urlParams}`;
  }

  /*
   * search
   */

  @action setSearchString(searchString: string): void {
    this.searchString = searchString;
  }

  @computed get hasSearchString(): boolean {
    return !!this.searchString;
  }

  @computed get allEntitiesUrl(): string {
    const path = generatePath(this.urlMatch || '', this.commonPathParams);
    const urlParams = this.convertToUrlParams(this.commonUrlParams);

    return `${path}?${urlParams}`;
  }

  getSearchUrl(searchString: string): string {
    const path = this.pageUrlPath;
    const search = searchString;
    const urlParams = this.convertToUrlParams({ ...this.commonUrlParams, search });

    return `${path}?${urlParams}`;
  }

  /*
   * statuses
   */

  @action setFilterByStatus(filterStatus: keyof FS): void {
    this.filterByStatus = filterStatus;
  }

  @action setEntityActionPending(id: string, state: boolean): void {
    this.entityActionPending[id] = state;
  }

  getColumnConfig(column: SC): IEntitiesColumnsConfig | null {
    return this.columnsConfig?.[column] ?? null;
  }

  async callEntityAction<T extends {}>(
    id: string,
    url: string,
    method: TActionFetchMethod = 'put',
    body?: unknown,
  ): Promise<void | boolean | T> {
    this.setEntityActionPending(id, true);

    try {
      const response = await fetch(url, { method, body: JSON.stringify(body || {}) });
      const { status, ok } = response;

      if (status === 200) {
        try {
          const result: T = await response.json();

          return result;
        } catch {
          return true;
        } finally {
          this.updateEntitiesInPlace();
        }
      }

      if (ok) {
        this.updateEntitiesInPlace();

        return true;
      }

      ErrorsStore.processGetErrors(response, this.translationPrefix);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      this.setEntityActionPending(id, false);
    }
  }

  async callBatchEntityAction(url: string, method: TActionFetchMethod = 'put'): Promise<void | boolean> {
    const body = this.selectedEntitiesIds;

    try {
      const response = await fetch(url, { method, body: JSON.stringify(body || {}) });

      if (response.ok) {
        this.updateEntitiesInPlace();

        return true;
      }

      ErrorsStore.processGetErrors(response, this.translationPrefix);
    } catch (error) {
      ErrorsStore.showTempError(error);
    }
  }

  /*
   * group operations
   */

  @action toggleEntity(userId: string): void {
    this.selectedEntities = { ...this.selectedEntities, [userId]: !this.selectedEntities[userId] };
  }

  @action selectAllEntities(): void {
    const selectedEntities: Record<string, boolean> = {};
    this.entities.forEach(entity => {
      const id: string = entity.id;
      selectedEntities[id] = true;
    });

    this.selectedEntities = selectedEntities;
  }

  @action resetSelectedEntities(): void {
    this.selectedEntities = {};
  }

  @computed get isIndeterminateFlag(): boolean {
    return this.entities.some(entity => this.selectedEntities[entity.id]) && !this.isAllSelectedFlag;
  }

  @computed get isAllSelectedFlag(): boolean {
    return this.entities.every(entity => this.selectedEntities[entity.id]);
  }

  @computed get hasSelectedEntity(): boolean {
    return this.entities.some(entity => this.selectedEntities[entity.id]);
  }

  @computed get selectedEntitiesIds(): string[] {
    return this.entities.reduce((acc: string[], entity) => {
      if (this.selectedEntities[entity.id]) acc.push(entity.id);

      return acc;
    }, []);
  }

  @computed get selectedEntitiesCount(): number {
    return this.selectedEntitiesIds.length;
  }

  getIsSelectedFlag(id: string): boolean {
    return !!this.selectedEntities[id];
  }

  toggleAllEntities(isUncheck: boolean): void {
    if (isUncheck) this.resetSelectedEntities();
    else this.selectAllEntities();
  }

  /*
   * common
   */

  @computed get commonUrlParams(): Record<string, string> {
    const sortField = String(this.sortColumn);
    const sortDir = this.sortDir;
    const search = this.searchString;

    return { sortField, sortDir, search };
  }

  convertToUrlParams(params: Record<string, string>): string {
    return new URLSearchParams(pickBy(params)).toString();
  }
}

export default EntitiesStore;
