import { useState } from 'react';
import { CalendarPlus, SoccerBall } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorNote,
  Skeleton,
} from '@/components/ui';
import { EventCard } from '@/features/events/EventCard';
import { useEvents } from '@/features/events/api';
import { errorMessage } from '@/lib/api';
import { todayIso } from '@/lib/format';

export function EventsPage() {
  const { data: events, isPending, error, refetch } = useEvents();
  const [showPast, setShowPast] = useState(false);
  const reduceMotion = useReducedMotion();

  const today = todayIso();
  const upcoming = (events ?? [])
    .filter((event) => event.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const past = (events ?? [])
    .filter((event) => event.date < today)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Матчи</h1>
        <div className="hidden sm:block">
          <ButtonLink
            to="/events/new"
            icon={<CalendarPlus className="size-5" aria-hidden />}
          >
            Новый матч
          </ButtonLink>
        </div>
      </div>

      {isPending && (
        <div className="grid gap-3" role="status" aria-label="Загрузка матчей">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-panel" />
          ))}
        </div>
      )}

      {error && (
        <div className="grid gap-3">
          <ErrorNote>{errorMessage(error)}</ErrorNote>
          <Button
            variant="secondary"
            className="justify-self-start"
            onClick={() => refetch()}
          >
            Повторить
          </Button>
        </div>
      )}

      {events && upcoming.length === 0 && (
        <EmptyState
          icon={<SoccerBall className="size-10" weight="duotone" />}
          title="Ближайших матчей нет"
          action={
            <ButtonLink
              to="/events/new"
              icon={<CalendarPlus className="size-5" aria-hidden />}
            >
              Создать матч
            </ButtonLink>
          }
        >
          Создайте матч, и бот закрепит анонс в чате команды.
        </EmptyState>
      )}

      {upcoming.length > 0 && (
        <ul className="grid gap-3">
          {upcoming.map((event, index) => (
            <motion.li
              key={event._id}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: Math.min(index, 6) * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <EventCard event={event} />
            </motion.li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <section className="grid gap-3">
          <button
            type="button"
            aria-expanded={showPast}
            onClick={() => setShowPast((value) => !value)}
            className="flex h-11 items-center justify-self-start rounded-control px-2 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            {showPast ? 'Скрыть прошедшие' : `Прошедшие матчи (${past.length})`}
          </button>
          <AnimatePresence initial={false}>
            {showPast && (
              <motion.ul
                className="grid gap-3"
                initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                {past.map((event) => (
                  <li key={event._id}>
                    <EventCard event={event} past />
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Thumb-reach action on phones */}
      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 sm:hidden">
        <ButtonLink
          to="/events/new"
          size="lg"
          icon={<CalendarPlus className="size-5" aria-hidden />}
        >
          Новый матч
        </ButtonLink>
      </div>
    </div>
  );
}
