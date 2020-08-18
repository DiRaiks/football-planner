type TGetPageOffset = (page: number, perPage: number) => number;
type TGetOffsetFromUrl = (search: string) => number;

export const getPageOffset: TGetPageOffset = (page, perPage) => {
  return Math.max(0, page - 1) * perPage;
};

export const getOffsetFromUrl: TGetOffsetFromUrl = search => {
  const searchParams = new URLSearchParams(search);

  return Number(searchParams.get('offset')) || 0;
};
