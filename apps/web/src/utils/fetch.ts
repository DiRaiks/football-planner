import { getTokenFromLS } from './tokenLS';

export interface IFetchInit extends RequestInit {
  queryParams?: Record<string, string>;
}

type TFetch = (url: RequestInfo, options?: IFetchInit) => Promise<Response>;

export const fetch: TFetch = (url, options) => {
  const token = getTokenFromLS();
  const { queryParams = {}, ...rest } = options || {};
  const params = new URLSearchParams(queryParams).toString();

  let comboUrl = `${process.env.REACT_APP_FETCH_URL}${url}`;
  if (params) comboUrl += `?${params}`;

  return window.fetch(comboUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...rest?.headers,
    },
    cache: 'no-cache',
    ...rest,
  });
};
