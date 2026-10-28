import { useState } from 'react';
import { ChartBar } from '@phosphor-icons/react';

import {
  Button,
  EmptyState,
  ErrorNote,
  Segmented,
  Skeleton,
  cn,
} from '@/components/ui';
import { useUser } from '@/features/auth/auth';
import { useAttendance } from '@/features/stats/api';
import { errorMessage } from '@/lib/api';
import { formatDay, formatFullDay, plural } from '@/lib/format';

const PERIODS = [
  { value: '30', label: 'Месяц' },
  { value: '90', label: '3 месяца' },
  { value: '365', label: 'Год' },
  { value: '0', label: 'Всё время' },
] as const;

const MATCHES: [string, string, string] = ['матч', 'матча', 'матчей'];

/** Who came how often: played matches, "maybe" sign-ups, the last match played */
export function StatsPage() {
  const user = useUser();
  const [days, setDays] = useState<(typeof PERIODS)[number]['value']>('90');
  const { data: rows, isPending, error, refetch } = useAttendance(Number(days));
  const most = Math.max(1, ...(rows ?? []).map((row) => row.played));

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Посещаемость</h1>
        <Segmented
          label="Период"
          value={days}
          onChange={setDays}
          options={[...PERIODS]}
        />
      </div>

      {isPending && (
        <div className="grid gap-2" role="status" aria-label="Загрузка">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
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

      {rows?.length === 0 && (
        <EmptyState
          icon={<ChartBar className="size-10" weight="duotone" />}
          title="Пока пусто"
        >
          За этот период не было сыгранных матчей с записью игроков.
        </EmptyState>
      )}

      {rows && rows.length > 0 && (
        <ol className="grid gap-1">
          {rows.map((row, index) => (
            <li
              key={row.userId}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-1 rounded-control px-2 py-2.5"
            >
              <span className="font-mono text-sm text-muted tabular-nums">
                {index + 1}
              </span>
              <span
                className={cn(
                  'truncate',
                  row.userId === user._id && 'font-semibold',
                )}
              >
                {row.name}
                {row.userId === user._id && (
                  <span className="font-normal text-muted"> (вы)</span>
                )}
              </span>
              <span className="text-right font-mono tabular-nums">
                {row.played}
                <span className="sr-only"> {plural(row.played, MATCHES)}</span>
              </span>
              <span
                aria-hidden
                className="col-start-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
              >
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${(row.played / most) * 100}%` }}
                />
              </span>
              <span
                className="col-span-2 col-start-2 text-xs text-muted"
                title={
                  row.lastPlayed ? formatFullDay(row.lastPlayed) : undefined
                }
              >
                {row.lastPlayed
                  ? `последний: ${formatDay(row.lastPlayed)}`
                  : 'ещё не играл'}
                {row.maybe > 0 && ` · «возможно» ${row.maybe}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
