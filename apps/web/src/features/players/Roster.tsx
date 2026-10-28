import type { Player } from '@football-planner/shared';
import { CheckCircle, Circle, UsersThree } from '@phosphor-icons/react';

import { Avatar, cn } from '@/components/ui';

type Person = {
  key: string;
  name: string;
  /** Telegram photo of a player; friends have none */
  photoUrl?: string;
  broughtBy?: string;
  isMe: boolean;
  /** The player who pays for this person: themselves, or who brought the friend */
  payerId: string;
  paid: boolean;
};

/** Paying for the pitch: shown when the match has a price */
export type Payments = {
  price: number;
  /** Set for the organiser: marks a player as paid or not */
  onToggle?: (playerId: string, paid: boolean) => void;
};

/** Payments with the players who pay for someone in the squad */
type PaymentsView = Payments & { payers: Set<string> };

const rub = new Intl.NumberFormat('ru-RU');

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
    const { paid } = player;
    place(
      {
        key: player._id,
        name: player.name,
        ...(player.photoUrl && { photoUrl: player.photoUrl }),
        isMe: player.userId === myUserId,
        payerId: player._id,
        paid,
      },
      player.status,
    );
    player.friends.forEach((friend, index) =>
      place(
        {
          key: `${player._id}-${index}`,
          name: friend.name,
          broughtBy: player.name,
          isMe: false,
          payerId: player._id,
          paid,
        },
        friend.status,
      ),
    );
  }
  return { sure, maybe, waiting };
};

function PaidMark({
  person,
  payments,
}: {
  person: Person;
  payments: PaymentsView;
}) {
  const Icon = person.paid ? CheckCircle : Circle;
  // Friends are paid for by the player who brought them: only players get a switch,
  // those who pay for someone in the squad (a "maybe" player may bring a sure friend)
  const pays = payments.payers.has(person.payerId) || person.paid;
  if (payments.onToggle && !person.broughtBy && pays) {
    const toggle = payments.onToggle;
    return (
      <button
        type="button"
        aria-label={`${person.name}: ${person.paid ? 'оплатил' : 'не оплатил'}, изменить`}
        onClick={() => toggle(person.payerId, !person.paid)}
        className={cn(
          'ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-sm transition-[background-color,color] duration-150',
          person.paid
            ? 'bg-accent-soft text-ink'
            : 'text-muted hover:bg-surface-2 hover:text-ink',
        )}
      >
        <Icon
          className="size-5"
          weight={person.paid ? 'fill' : 'regular'}
          aria-hidden
        />
        {person.paid ? 'оплатил' : 'не оплатил'}
      </button>
    );
  }
  if (!person.paid) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 rounded-control bg-accent-soft px-2 py-1 text-sm text-ink">
      <CheckCircle className="size-4" weight="fill" aria-hidden />
      оплачено
    </span>
  );
}

function Group({
  title,
  people,
  muted,
  payments,
}: {
  title: string;
  people: Person[];
  muted?: boolean;
  payments?: PaymentsView;
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
            <Avatar
              name={person.name}
              photoUrl={person.photoUrl}
              muted={muted}
            />
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
            {payments && <PaidMark person={person} payments={payments} />}
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
  payments,
}: {
  players: Player[];
  myUserId: string;
  maximum?: number;
  payments?: Payments;
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

  const view = payments && {
    ...payments,
    payers: new Set(sure.map((person) => person.payerId)),
  };
  const collected = payments
    ? sure.filter((person) => person.paid).length * payments.price
    : 0;

  return (
    <div className="grid gap-5">
      {payments && sure.length > 0 && (
        <p className="text-sm text-muted">
          Собрано{' '}
          <span className="font-medium text-ink tabular-nums">
            {rub.format(collected)} ₽
          </span>{' '}
          из{' '}
          <span className="tabular-nums">
            {rub.format(sure.length * payments.price)} ₽
          </span>
        </p>
      )}
      <Group title="Точно идут" people={sure} payments={view} />
      <Group title="Лист ожидания" people={waiting} muted payments={view} />
      <Group title="Под вопросом" people={maybe} muted payments={view} />
    </div>
  );
}
