import { useState } from 'react';
import type { Event } from '@football-planner/shared';
import { Shuffle } from '@phosphor-icons/react';

import { Button, ErrorNote, Segmented, cn } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useSplitTeams } from './api';

const COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-orange-500',
  'bg-violet-500',
];
const COUNTS = ['2', '3', '4'] as const;

/**
 * Teams of the match: everyone sees the split, the organiser makes it. A split shuffles
 * the squad, so pressing again gives new teams; the bot posts them to the chat.
 */
export function Teams({
  event,
  canManage,
}: {
  event: Event;
  canManage: boolean;
}) {
  const split = useSplitTeams(event._id);
  const [count, setCount] = useState<(typeof COUNTS)[number]>(
    String(
      Math.min(Math.max(event.teams?.length ?? 2, 2), 4),
    ) as (typeof COUNTS)[number],
  );
  const teams = event.teams ?? [];

  if (!canManage && teams.length === 0) return null;

  return (
    <section aria-label="Команды" className="grid gap-4">
      <h2 className="text-lg font-semibold">Команды</h2>
      {teams.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team, index) => (
            <div
              key={index}
              className="grid content-start gap-2 rounded-panel border border-line bg-surface p-4"
            >
              <h3 className="flex items-center gap-2 font-medium">
                <span
                  aria-hidden
                  className={cn('size-3 rounded-full', COLORS[index])}
                />
                Команда {index + 1}
                <span className="font-mono text-sm text-muted tabular-nums">
                  {team.length}
                </span>
              </h3>
              <ul className="grid gap-1 text-sm">
                {team.map((name, i) => (
                  <li key={i} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-pretty text-muted">
          Разбейте состав на команды случайно: бот пришлёт их в чат.
        </p>
      )}
      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Сколько команд"
            value={count}
            onChange={setCount}
            options={COUNTS.map((value) => ({ value, label: value }))}
          />
          <Button
            variant="secondary"
            icon={<Shuffle className="size-5" aria-hidden />}
            loading={split.isPending}
            onClick={() => split.mutate(Number(count))}
          >
            {teams.length > 0 ? 'Перемешать' : 'Разбить на команды'}
          </Button>
        </div>
      )}
      {split.error && <ErrorNote>{errorMessage(split.error)}</ErrorNote>}
    </section>
  );
}
