import { CalendarX } from '@phosphor-icons/react';

import { ButtonLink, EmptyState, ErrorNote } from '@/components/ui';
import { errorMessage, isNotFound } from '@/lib/api';

/** Shown instead of a match page when the match is gone or could not be loaded */
export function EventUnavailable({ error }: { error: unknown }) {
  const backToList = (
    <ButtonLink to="/events" variant="secondary">
      К списку матчей
    </ButtonLink>
  );

  if (isNotFound(error)) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={<CalendarX className="size-10" aria-hidden />}
          title="Матч не найден"
          action={backToList}
        >
          Возможно, его удалили или ссылка устарела.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <ErrorNote>{errorMessage(error)}</ErrorNote>
      <div>{backToList}</div>
    </div>
  );
}
