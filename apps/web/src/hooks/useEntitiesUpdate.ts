import { useEffect, useCallback } from 'react';
import { useObserver } from 'mobx-react';
import { useLocation, useHistory } from 'react-router-dom';
import { getOffsetFromUrl, getSearchString, getSortParams } from 'utils';
import { EntitiesStore, TSortDir } from 'store';

type TDependency = string | null;

export const usePageEntitiesUpdate = <T extends { id: string }, FS extends { all: string }, SC extends string>(
  Store: EntitiesStore<T, FS, SC>,
  status: keyof FS = 'all',
  dependencies: TDependency[] = [],
): {
  onSearch: (value: string) => void;
  searchString: string;
} => {
  const { search: urlSearchString } = useLocation();
  const history = useHistory();

  const onUrlChange = useCallback(
    (url: string) => {
      history.replace(url);
    },
    [history],
  );

  const perPage = useObserver(() => Store.perPage);

  const { onSearch, searchString, offset, sortColumn, sortDir } = useEntitiesUrlSearchString(
    Store,
    onUrlChange,
    urlSearchString,
  );

  useEffect(() => {
    Store.updateEntities(status, offset, sortColumn, sortDir, searchString);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Store, status, offset, perPage, sortColumn, sortDir, searchString, ...dependencies]);

  useEffect(() => {
    return (): void => Store.resetEntities();
  }, [Store]);

  return { onSearch, searchString };
};

export const useEntitiesUrlSearchString = <T extends { id: string }, FS extends { all: string }, SC extends string>(
  Store: EntitiesStore<T, FS, SC>,
  onUrlChange: (url: string) => void,
  urlSearchString: string,
): {
  onSearch: (value: string) => void;
  offset: number;
  searchString: string;
  sortColumn?: SC;
  sortDir?: TSortDir;
} => {
  const offset = getOffsetFromUrl(urlSearchString);
  const searchString = getSearchString(urlSearchString);
  const { sortColumn, sortDir } = getSortParams<SC>(urlSearchString);

  const onSearch = useCallback(
    (value: string) => {
      if (value === Store.searchString) return;
      onUrlChange(Store.getSearchUrl(value));
    },
    [Store, onUrlChange],
  );

  return { onSearch, searchString, offset, sortColumn, sortDir };
};

export const useEntitiesPagination = <T extends { id: string }, FS extends { all: string }, SC extends string>(
  Store: EntitiesStore<T, FS, SC>,
): {
  offset: number;
  totalRecords: number;
  perPage: number;
  setPerPage: (value: number) => void;
  getUrlHandler: (page: number) => string;
} => {
  const perPage = useObserver(() => Store.perPage);
  const totalRecords = useObserver(() => Store.totalRecords);
  const getUrlHandler = useObserver(() => Store.getPageUrl);
  const history = useHistory();
  const { search } = useLocation();

  const offset = getOffsetFromUrl(search);

  const setPerPage = useCallback(
    (perPage: number) => {
      Store.setPerPage(perPage);
      history.push(getUrlHandler(0));
    },
    [Store, getUrlHandler, history],
  );

  return { totalRecords, getUrlHandler, offset, perPage, setPerPage };
};

export const useEntitiesLoadMore = <T extends { id: string }, FS extends { all: string }, SC extends string>(
  Store: EntitiesStore<T, FS, SC>,
): {
  isLoadMorePending: boolean;
  hasMoreEntities: boolean;
  handleLoadMore: () => void;
} => {
  const totalLoaded = useObserver(() => Store.entities.length);
  const totalRecords = useObserver(() => Store.totalRecords);
  const isLoadMorePending = useObserver(() => Store.isLoadMorePending);
  const hasMoreEntities = !!totalLoaded && totalLoaded < totalRecords;

  const handleLoadMore = useCallback(() => {
    Store.loadNextPage();
  }, [Store]);

  return { isLoadMorePending, hasMoreEntities, handleLoadMore };
};
