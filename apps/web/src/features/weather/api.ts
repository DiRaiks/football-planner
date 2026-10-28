import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { City, DefaultLocation } from '@football-planner/shared';

import { api } from '@/lib/api';

/** Cities by the start of their name; from two letters on */
export const useCities = (query: string) => {
  const q = query.trim();
  return useQuery({
    queryKey: ['weather', 'cities', q.toLowerCase()] as const,
    queryFn: () =>
      api<City[]>('GET', `/weather/cities?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    // Keeps the list in place while the next letters load
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  });
};

/** Where the weather of matches without a city comes from */
export const useDefaultLocation = () =>
  useQuery({
    queryKey: ['weather', 'default'] as const,
    queryFn: () => api<DefaultLocation>('GET', '/weather/default'),
    staleTime: Infinity,
  });
