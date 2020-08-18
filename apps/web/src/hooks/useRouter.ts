/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { useMemo } from 'react';
import { useParams, useLocation, useHistory, useRouteMatch } from 'react-router-dom';
import queryString, { ParsedQuery } from 'query-string';

const queryToSearch = (query: ParsedQuery) => queryString.stringify(query);
const historyMethodDecorator = (history: any, method: 'push' | 'replace') => (location: any, ...otherArgs: any) => {
  const firstArg =
    typeof location === 'object' && location.query
      ? { ...location, search: queryToSearch(location.query), query: undefined }
      : location;

  return history[method](firstArg, ...otherArgs);
};

export function useRouter() {
  const params = useParams();
  const location = useLocation();
  const history = useHistory();
  const match = useRouteMatch();

  // Return our custom router object
  // Memoize so that a new object is only returned if something changes
  return useMemo(() => {
    return {
      push: historyMethodDecorator(history, 'push'),
      replace: historyMethodDecorator(history, 'replace'),
      pathname: location.pathname,
      query: queryString.parse(location.search),
      match,
      location,
      history,
      params,
    };
  }, [params, match, location, history]);
}
