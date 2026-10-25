import { TSortDir } from 'store';

export const getSortParams = <T extends string>(search: string): { sortColumn?: T; sortDir?: TSortDir } => {
  const searchParams = new URLSearchParams(search);
  const sortColumn = (searchParams.get('sortField') as T) || undefined;
  const sortDir = (searchParams.get('sortDir') as TSortDir) || undefined;

  return {
    sortColumn,
    sortDir,
  };
};
