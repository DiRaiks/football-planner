import { Link } from 'react-router';
import type { Event } from '@football-planner/shared';
import { CaretRight } from '@phosphor-icons/react';

import { cn } from '@/components/ui';
import { dayParts, formatFullDay } from '@/lib/format';

/** A match in the list: date block, name and place, sure players against the minimum */
export function EventCard({
  event,
  past = false,
}: {
  event: Event;
  past?: boolean;
}) {
  const parts = dayParts(event.date);

  return (
    <Link
      to={`/events/${event._id}`}
      className={cn(
        'group flex items-center gap-4 rounded-panel bg-surface p-3 pr-4 shadow-panel',
        'transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px active:scale-[0.99]',
      )}
    >
      <div
        title={formatFullDay(event.date)}
        className={cn(
          'grid w-16 shrink-0 justify-items-center rounded-[12px] py-2',
          past ? 'bg-surface-2 text-muted' : 'bg-pitch text-pitch-ink',
        )}
      >
        <span
          className={cn('text-xs', past ? 'text-muted' : 'text-pitch-muted')}
        >
          {parts?.weekday ?? ''}
        </span>
        <span className="font-mono text-2xl leading-7 font-semibold tabular-nums">
          {parts?.day ?? '?'}
        </span>
        <span
          className={cn('text-xs', past ? 'text-muted' : 'text-pitch-muted')}
        >
          {parts?.month ?? event.date}
        </span>
      </div>

      <div className="grid min-w-0 flex-1 gap-0.5">
        <h3 className={cn('truncate font-semibold', past && 'text-muted')}>
          {event.eventName}
        </h3>
        <p className="truncate text-sm text-muted">
          {event.time}, {event.place}
        </p>
      </div>

      <div className="grid shrink-0 justify-items-end">
        <span
          className="font-mono text-lg font-semibold tabular-nums"
          aria-label={`Записалось ${event.playersAmount}${event.minimum ? ` из минимум ${event.minimum}` : ''}`}
        >
          {event.playersAmount}
          {event.minimum > 0 && (
            <span className="text-sm font-normal text-muted">
              /{event.minimum}
            </span>
          )}
        </span>
      </div>
      <CaretRight
        className="size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
