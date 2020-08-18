export type TSortDir = 'ascending' | 'descending';
export type TEntitiesCounters = Record<string, number | null>;
export type TActionFetchMethod = 'post' | 'put' | 'delete';

export interface IEntitiesColumnsState<SC> {
  urlMatch: string;
  entitiesUrl: string;
  entitiesField: string;
  subField?: SC;
  sortDir?: TSortDir;
  sortColumn: SC;
  columnsOrder: SC[];
  columnsConfig?: TColumnConfig<SC>;
  hasDeprecatedPascalCase?: boolean;
  translationPrefix?: string;
  counters: TEntitiesCounters;
}

export interface IEntitiesColumnsConfig {
  sortable?: boolean;
}

export type TColumnConfig<T> = Partial<Record<T, IEntitiesColumnsConfig>> | undefined;
