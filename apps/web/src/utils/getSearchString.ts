type TGetSearchString = (search: string) => string;

export const getSearchString: TGetSearchString = search => {
  const searchParams = new URLSearchParams(search);

  return searchParams.get('search') || '';
};
