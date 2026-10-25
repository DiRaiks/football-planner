import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventBody,
  Event,
  EventWeather,
  UpdateEventBody,
} from '@football-planner/shared';

import { api } from '@/lib/api';

export const eventsKey = ['events'] as const;
export const eventKey = (id: string) => ['events', id] as const;
export const weatherKey = (id: string) => ['events', id, 'weather'] as const;

export const useEvents = () =>
  useQuery({
    queryKey: eventsKey,
    queryFn: () => api<Event[]>('GET', '/events'),
  });

export const useEvent = (id: string) =>
  useQuery({
    queryKey: eventKey(id),
    queryFn: () => api<Event>('GET', `/events/${id}`),
  });

export const useWeather = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: weatherKey(id),
    queryFn: () => api<EventWeather>('GET', `/events/${id}/weather`),
    enabled,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEventBody) => api<Event>('POST', '/events', body),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKey(event._id), event);
      void queryClient.invalidateQueries({ queryKey: eventsKey, exact: true });
    },
  });
};

export const useUpdateEvent = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEventBody) =>
      api<Event>('PATCH', `/events/${id}`, body),
    onSuccess: (event) => {
      queryClient.setQueryData(eventKey(id), event);
      void queryClient.invalidateQueries({ queryKey: eventsKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: weatherKey(id) });
    },
  });
};

export const useSplitTeams = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (count: number) =>
      api<Event>('POST', `/events/${id}/teams`, { count }),
    onSuccess: (event) => queryClient.setQueryData(eventKey(id), event),
  });
};

export const useDeleteEvent = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('DELETE', `/events/${id}`),
    onSuccess: () => {
      queryClient.setQueryData<Event[]>(eventsKey, (events) =>
        events?.filter((event) => event._id !== id),
      );
      queryClient.removeQueries({ queryKey: eventKey(id), exact: true });
    },
  });
};
