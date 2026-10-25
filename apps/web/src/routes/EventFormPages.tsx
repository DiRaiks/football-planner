import { useNavigate, useParams } from 'react-router';

import { Skeleton } from '@/components/ui';
import { EventUnavailable } from '@/features/events/EventUnavailable';
import { EventForm } from '@/features/events/EventForm';
import {
  useCreateEvent,
  useEvent,
  useUpdateEvent,
} from '@/features/events/api';
import { errorMessage } from '@/lib/api';

export function NewEventPage() {
  const navigate = useNavigate();
  const create = useCreateEvent();

  return (
    <div className="mx-auto grid max-w-lg gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Новый матч</h1>
      <EventForm
        submitLabel="Создать матч"
        pending={create.isPending}
        error={create.error ? errorMessage(create.error) : null}
        onCancel={() => navigate(-1)}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (event) =>
              navigate(`/events/${event._id}`, { replace: true }),
          })
        }
      />
    </div>
  );
}

export function EditEventPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const event = useEvent(eventId);
  const update = useUpdateEvent(eventId);

  if (event.error) return <EventUnavailable error={event.error} />;

  return (
    <div className="mx-auto grid max-w-lg gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Изменить матч</h1>
      {event.data ? (
        <EventForm
          initial={event.data}
          submitLabel="Сохранить"
          pending={update.isPending}
          error={update.error ? errorMessage(update.error) : null}
          onCancel={() => navigate(-1)}
          onSubmit={(values) =>
            update.mutate(values, {
              onSuccess: () =>
                navigate(`/events/${eventId}`, { replace: true }),
            })
          }
        />
      ) : (
        <Skeleton className="h-96 rounded-panel" />
      )}
    </div>
  );
}
