import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Event,
  Player,
  PlayersChange,
  SignUpBody,
  UpdatePlayerBody,
} from '@football-planner/shared';

import { api } from '@/lib/api';
import { eventKey, eventsKey } from '@/features/events/api';

export const playersKey = (eventId: string) =>
  ['events', eventId, 'players'] as const;

export const usePlayers = (eventId: string) =>
  useQuery({
    queryKey: playersKey(eventId),
    queryFn: () => api<Player[]>('GET', `/events/${eventId}/players`),
  });

/** Counts people (players and their friends) by status, like the server does */
/** Sure people beyond `maximum` places (0: no limit) wait in line, as on the server */
export const countPeople = (
  players: Pick<Player, 'status' | 'friends'>[],
  maximum = 0,
) => {
  let sure = 0;
  let maybe = 0;
  for (const person of players.flatMap((player) => [
    player,
    ...player.friends,
  ])) {
    if (person.status) sure++;
    else maybe++;
  }
  const exactly = maximum > 0 ? Math.min(sure, maximum) : sure;
  return { all: sure + maybe, exactly, maybe, waiting: sure - exactly };
};

/**
 * Sign-up mutations update the roster optimistically: the screen reacts instantly,
 * and the server response (or a rollback on error) settles it.
 */
const usePlayersMutation = <TVariables>(
  eventId: string,
  request: (variables: TVariables) => Promise<PlayersChange>,
  optimistic: (players: Player[], variables: TVariables) => Player[],
) => {
  const queryClient = useQueryClient();
  const key = playersKey(eventId);

  return useMutation({
    mutationKey: key,
    mutationFn: request,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Player[]>(key);
      if (previous)
        queryClient.setQueryData(key, optimistic(previous, variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: ({ players, event }) => {
      // A newer change is still in flight: let it settle the roster instead
      if (queryClient.isMutating({ mutationKey: key }) <= 1) {
        queryClient.setQueryData(key, players);
      }
      queryClient.setQueryData(eventKey(eventId), event);
      queryClient.setQueryData<Event[]>(eventsKey, (events) =>
        events?.map((item) => (item._id === event._id ? event : item)),
      );
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    // After the last of overlapping changes, or after an error, read the real roster
    onSettled: (_data, error) => {
      if (error || queryClient.isMutating({ mutationKey: key }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: key, exact: true });
      }
    },
  });
};

const PENDING_ID = 'pending';

export const useSignUp = (eventId: string, userId: string) =>
  usePlayersMutation(
    eventId,
    (body: SignUpBody) =>
      api<PlayersChange>('POST', `/events/${eventId}/players`, body),
    (players, body) => [
      ...players,
      {
        ...body,
        _id: PENDING_ID,
        eventId,
        userId,
        date: '',
        waitlisted: false,
        paid: false,
      },
    ],
  );

export const useUpdatePlayer = (eventId: string) =>
  usePlayersMutation(
    eventId,
    ({ playerId, body }: { playerId: string; body: UpdatePlayerBody }) =>
      api<PlayersChange>(
        'PATCH',
        `/events/${eventId}/players/${playerId}`,
        body,
      ),
    (players, { playerId, body }) =>
      players.map((player) =>
        player._id === playerId ? { ...player, ...body } : player,
      ),
  );

/** The organiser marks who paid; the roster updates at once */
export const useSetPaid = (eventId: string) => {
  const queryClient = useQueryClient();
  const key = playersKey(eventId);
  return useMutation({
    mutationFn: ({ playerId, paid }: { playerId: string; paid: boolean }) =>
      api<Player>('PATCH', `/events/${eventId}/players/${playerId}/paid`, {
        paid,
      }),
    onMutate: async ({ playerId, paid }) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Player[]>(key, (players) =>
        players?.map((player) =>
          player._id === playerId ? { ...player, paid } : player,
        ),
      );
    },
    // Undo only this mark: other marks made meanwhile stand
    onError: (_error, { playerId, paid }) =>
      queryClient.setQueryData<Player[]>(key, (players) =>
        players?.map((player) =>
          player._id === playerId ? { ...player, paid: !paid } : player,
        ),
      ),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: key, exact: true }),
  });
};

export const useLeave = (eventId: string) =>
  usePlayersMutation(
    eventId,
    (playerId: string) =>
      api<PlayersChange>('DELETE', `/events/${eventId}/players/${playerId}`),
    (players, playerId) => players.filter((player) => player._id !== playerId),
  );
