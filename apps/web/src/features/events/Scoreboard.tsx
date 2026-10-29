import { shareOf, type Event } from '@football-planner/shared';
import { ArrowsClockwise, MapPin, Wallet } from '@phosphor-icons/react';

import { cn } from '@/components/ui';
import { formatDay, formatFullDay, plural, PLAYERS } from '@/lib/format';
import { WeatherBadge } from '@/features/weather/WeatherBadge';

type Count = { all: number; exactly: number; maybe: number; waiting?: number };

const rub = new Intl.NumberFormat('ru-RU');

/** "300 ₽ с человека", or the pitch shared by the squad so far */
function PriceNote({ event, squad }: { event: Event; squad: number }) {
  const price = event.price ?? 0;
  const share = shareOf(price, event.priceMode, squad);
  const pitch = event.priceMode === 'pitch';
  return (
    <span
      className="flex items-center gap-1.5"
      title={
        pitch
          ? 'Аренда поля делится поровну на всех, кто точно идёт'
          : undefined
      }
    >
      <Wallet className="size-4 shrink-0" aria-hidden />
      {share === null ? (
        <span>
          поле <span className="tabular-nums">{rub.format(price)} ₽</span> на
          всех
        </span>
      ) : (
        <span>
          <span className="tabular-nums">
            {pitch && '~'}
            {rub.format(share)} ₽
          </span>{' '}
          с человека
          {pitch && (
            <>
              {' '}
              · поле <span className="tabular-nums">{rub.format(price)} ₽</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Cells for sure and maybe players against the minimum. Sure players fill solid,
 * maybe players are outlined, the rest of the minimum stays empty.
 */
export function ProgressCells({
  count,
  minimum,
}: {
  count: Count;
  minimum: number;
}) {
  const total = Math.max(minimum, count.all, 1);
  return (
    <div
      className="grid gap-1"
      style={{
        gridTemplateColumns: `repeat(${Math.min(total, 24)}, minmax(0, 1fr))`,
      }}
      aria-hidden
    >
      {Array.from({ length: Math.min(total, 24) }, (_, i) => {
        const state =
          i < count.exactly ? 'sure' : i < count.all ? 'maybe' : 'empty';
        return (
          <span
            key={i}
            className={cn(
              'h-2 rounded-full transition-colors duration-300',
              state === 'sure' && 'bg-accent',
              state === 'maybe' && 'border border-accent/70',
              state === 'empty' && 'bg-pitch-ink/15',
              i === minimum - 1 &&
                minimum > 0 &&
                'ring-1 ring-pitch-ink/50 ring-offset-1 ring-offset-pitch',
            )}
          />
        );
      })}
    </div>
  );
}

export const missingText = (count: Count, minimum: number) => {
  if (minimum <= 0) return null;
  const missing = minimum - count.exactly;
  return missing > 0
    ? `Нужно ещё ${missing} ${plural(missing, PLAYERS)}`
    : 'Минимум набран';
};

/** The match header: what, when, where, and how many are coming */
export function Scoreboard({ event, count }: { event: Event; count: Count }) {
  const missing = missingText(count, event.minimum);
  const reached = event.minimum > 0 && count.exactly >= event.minimum;

  return (
    <section
      aria-label="Табло матча"
      className="relative overflow-hidden rounded-panel bg-pitch p-5 text-pitch-ink shadow-panel sm:p-6"
    >
      {/* Faint centre line and circle of a pitch, purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full border border-pitch-ink/10"
      />
      <div className="relative grid gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-pitch-muted">
              <time
                dateTime={event.date}
                title={`${formatFullDay(event.date)}, ${event.time}`}
              >
                {formatDay(event.date)}, {event.time}
              </time>
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {event.eventName}
            </h1>
            <p className="flex items-center gap-1.5 text-pitch-muted">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {event.place}
            </p>
            {((event.price ?? 0) > 0 || event.repeat === 'weekly') && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-pitch-muted">
                {(event.price ?? 0) > 0 && (
                  <PriceNote event={event} squad={count.exactly} />
                )}
                {event.repeat === 'weekly' && (
                  <span className="flex items-center gap-1.5">
                    <ArrowsClockwise className="size-4 shrink-0" aria-hidden />
                    каждую неделю
                  </span>
                )}
              </p>
            )}
          </div>
          <WeatherBadge eventId={event._id} />
        </div>

        <div className="grid gap-3">
          <p
            className="flex items-baseline gap-2 font-mono tabular-nums"
            aria-live="polite"
          >
            <span className="text-5xl font-semibold tracking-tight">
              {count.exactly}
            </span>
            {event.minimum > 0 && (
              <span className="text-2xl text-pitch-muted">
                / {event.minimum}
              </span>
            )}
            <span className="sr-only">
              {plural(count.exactly, PLAYERS)} точно, ещё {count.maybe} возможно
            </span>
          </p>
          <ProgressCells count={count} minimum={event.minimum} />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            {missing && (
              <span
                className={cn(
                  'font-medium',
                  reached ? 'text-accent' : 'text-pitch-ink',
                )}
              >
                {missing}
              </span>
            )}
            {count.maybe > 0 && (
              <span className="text-pitch-muted">
                ещё {count.maybe} под вопросом
              </span>
            )}
            {(event.maximum ?? 0) > 0 && (
              <span className="text-pitch-muted">
                мест {event.maximum}
                {(count.waiting ?? 0) > 0 &&
                  ` · ${count.waiting} в листе ожидания`}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
