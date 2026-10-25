import type { Player } from '@football-planner/shared';
import { UsersThree } from '@phosphor-icons/react';

import { Avatar, cn } from '@/components/ui';

type Person = { key: string; name: string; broughtBy?: string; isMe: boolean };

/**
 * Splits players and their friends into "sure", "maybe" and "waiting". Players arrive in
 * sign-up order; like the server, each sure person takes the next of `maximum` places
 * (0: no limit), and later sure people wait in line.
 */
export const rosterGroups = (
  players: Player[],
  myUserId: string,
  maximum = 0,
) => {
  const sure: Person[] = [];
  const maybe: Person[] = [];
  const waiting: Person[] = [];
  const place = (person: Person, status: boolean) => {
    if (!status) maybe.push(person);
    else if (maximum > 0 && sure.length >= maximum) waiting.push(person);
    else sure.push(person);
  };

  for (const player of players) {
    place(
      { key: player._id, name: player.name, isMe: player.userId === myUserId },
      player.status,
    );
    player.friends.forEach((friend, index) =>
      place(
        {
          key: `${player._id}-${index}`,
          name: friend.name,
          broughtBy: player.name,
          isMe: false,
        },
        friend.status,
      ),
    );
  }
  return { sure, maybe, waiting };
};

function Group({
  title,
  people,
  muted,
}: {
  title: string;
  people: Person[];
  muted?: boolean;
}) {
  if (people.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-medium text-muted">
        {title}
        <span className="font-mono tabular-nums">{people.length}</span>
      </h3>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {people.map((person) => (
          <li
            key={person.key}
            className="flex min-h-12 items-center gap-3 rounded-control px-1"
          >
            <Avatar name={person.name} muted={muted} />
            <span className="grid min-w-0">
              <span className={cn('truncate', person.isMe && 'font-semibold')}>
                {person.name}
                {person.isMe && (
                  <span className="font-normal text-muted"> (вы)</span>
                )}
              </span>
              {person.broughtBy && (
                <span className="truncate text-xs text-muted">
                  по приглашению: {person.broughtBy}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Roster({
  players,
  myUserId,
  maximum = 0,
}: {
  players: Player[];
  myUserId: string;
  maximum?: number;
}) {
  const { sure, maybe, waiting } = rosterGroups(players, myUserId, maximum);

  if (sure.length + maybe.length + waiting.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-panel border border-dashed border-line p-5 text-muted">
        <UsersThree className="size-6 shrink-0" aria-hidden />
        <p>Пока никто не записался. Будьте первым, остальные подтянутся.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Group title="Точно идут" people={sure} />
      <Group title="Лист ожидания" people={waiting} muted />
      <Group title="Под вопросом" people={maybe} muted />
    </div>
  );
}
