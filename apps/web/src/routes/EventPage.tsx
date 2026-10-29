import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, PencilSimple, Trash } from '@phosphor-icons/react';
import { shareOf } from '@football-planner/shared';

import {
  ConfirmDialog,
  ErrorNote,
  IconButton,
  Skeleton,
} from '@/components/ui';
import { useUser } from '@/features/auth/auth';
import { EventUnavailable } from '@/features/events/EventUnavailable';
import { PaymentDetails } from '@/features/events/PaymentDetails';
import { Scoreboard } from '@/features/events/Scoreboard';
import { Teams } from '@/features/events/Teams';
import { useDeleteEvent, useEvent } from '@/features/events/api';
import { JoinPanel } from '@/features/players/JoinPanel';
import { Roster } from '@/features/players/Roster';
import { countPeople, usePlayers, useSetPaid } from '@/features/players/api';
import { errorMessage } from '@/lib/api';
import { todayIso } from '@/lib/format';

export function EventPage() {
  const { eventId = '' } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const event = useEvent(eventId);
  const players = usePlayers(eventId);
  const remove = useDeleteEvent(eventId);
  const setPaid = useSetPaid(eventId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // An error first: the players may still be loading when the match is already gone
  if (event.error || players.error) {
    return <EventUnavailable error={event.error ?? players.error} />;
  }

  if (event.isPending || players.isPending) {
    return (
      <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
      </div>
    );
  }

  const count = countPeople(players.data, event.data.maximum ?? 0);
  const canManage = event.data.creatorId === user._id || user.role === 'admin';
  const isPast = event.data.date < todayIso();
  const price = event.data.price ?? 0;
  const pitch = event.data.priceMode === 'pitch';

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/events"
          className="-ml-2 flex h-11 items-center gap-1.5 rounded-control px-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Матчи
        </Link>
        {canManage && (
          <div className="flex gap-1">
            <IconButton
              label="Изменить матч"
              onClick={() => navigate(`/events/${eventId}/edit`)}
            >
              <PencilSimple className="size-5" aria-hidden />
            </IconButton>
            <IconButton
              label="Удалить матч"
              className="hover:bg-danger-soft hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash className="size-5" aria-hidden />
            </IconButton>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-6 lg:sticky lg:top-24">
          <Scoreboard event={event.data} count={count} />
          {!isPast && (
            <JoinPanel eventId={eventId} user={user} players={players.data} />
          )}
        </div>
        <section aria-label="Состав" className="grid gap-4">
          <h2 className="text-lg font-semibold">Состав</h2>
          <Roster
            players={players.data}
            myUserId={user._id}
            maximum={event.data.maximum ?? 0}
            payments={
              price > 0
                ? {
                    price:
                      shareOf(price, event.data.priceMode, count.exactly) ?? 0,
                    ...(pitch && { total: price }),
                    ...(canManage && {
                      onToggle: (playerId, paid) =>
                        setPaid.mutate({ playerId, paid }),
                    }),
                  }
                : undefined
            }
          />
          {setPaid.error && (
            <ErrorNote>{errorMessage(setPaid.error)}</ErrorNote>
          )}
          {price > 0 && (
            <PaymentDetails
              eventId={eventId}
              isCreator={event.data.creatorId === user._id}
            />
          )}
          <Teams key={eventId} event={event.data} canManage={canManage} />
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить матч?"
        confirmLabel="Удалить"
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => navigate('/events', { replace: true }),
          })
        }
      >
        Запись игроков пропадёт, а в чатах анонс отметится как отменённый.
        {remove.error && <ErrorNote>{errorMessage(remove.error)}</ErrorNote>}
      </ConfirmDialog>
    </div>
  );
}
