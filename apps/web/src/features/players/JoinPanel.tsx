import { useState, type FormEvent } from 'react';
import type { Friend, Player, User } from '@football-planner/shared';
import { Check, Plus, Question, UserPlus, X } from '@phosphor-icons/react';

import { Button, ErrorNote, IconButton, Segmented, cn } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useLeave, useSignUp, useUpdatePlayer } from './api';

type Status = 'sure' | 'maybe';
const toStatus = (value: boolean): Status => (value ? 'sure' : 'maybe');

const STATUS_OPTIONS = [
  {
    value: 'sure' as const,
    label: 'Иду',
    icon: <Check className="size-4" weight="bold" aria-hidden />,
  },
  {
    value: 'maybe' as const,
    label: 'Возможно',
    icon: <Question className="size-4" weight="bold" aria-hidden />,
  },
];

/** Signing up, changing the decision and bringing friends, all on the match screen */
export function JoinPanel({
  eventId,
  user,
  players,
}: {
  eventId: string;
  user: User;
  players: Player[];
}) {
  const me = players.find((player) => player.userId === user._id);
  const signUp = useSignUp(eventId, user._id);
  const update = useUpdatePlayer(eventId);
  const leave = useLeave(eventId);
  // Only the outcome of the latest action is shown
  const mutations = [signUp, update, leave];
  const latest = mutations.reduce((a, b) =>
    b.submittedAt > a.submittedAt ? b : a,
  );
  const error = latest.error;

  if (!me) {
    return (
      <section aria-label="Запись на матч" className="grid gap-3">
        <h2 className="text-lg font-semibold">Вы идёте?</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            icon={<Check className="size-5" weight="bold" aria-hidden />}
            loading={signUp.isPending && signUp.variables?.status === true}
            disabled={signUp.isPending}
            onClick={() =>
              signUp.mutate({ name: user.name, status: true, friends: [] })
            }
          >
            Иду
          </Button>
          <Button
            size="lg"
            variant="secondary"
            icon={<Question className="size-5" weight="bold" aria-hidden />}
            loading={signUp.isPending && signUp.variables?.status === false}
            disabled={signUp.isPending}
            onClick={() =>
              signUp.mutate({ name: user.name, status: false, friends: [] })
            }
          >
            Возможно
          </Button>
        </div>
        {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      </section>
    );
  }

  const pending = me._id === 'pending';
  const setFriends = (friends: Friend[]) =>
    update.mutate({ playerId: me._id, body: { friends } });

  return (
    <section
      aria-label="Ваша запись"
      className="grid gap-4 rounded-panel bg-surface p-4 shadow-panel sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ваша запись</h2>
        <Button
          variant="danger"
          disabled={pending}
          loading={leave.isPending}
          onClick={() => leave.mutate(me._id)}
        >
          Не пойду
        </Button>
      </div>

      {me.waitlisted && (
        <p className="rounded-control bg-accent-soft px-3 py-2.5 text-sm text-pretty">
          Мест нет: вы в листе ожидания. Когда кто-то откажется, вы попадёте в
          состав, а бот напишет об этом в чат.
        </p>
      )}

      <Segmented
        label="Ваш статус"
        value={toStatus(me.status)}
        options={STATUS_OPTIONS}
        onChange={(value) =>
          !pending &&
          update.mutate({
            playerId: me._id,
            body: { status: value === 'sure' },
          })
        }
      />

      <div className="grid gap-2">
        <h3 className="text-sm font-medium text-muted">Друзья</h3>
        {me.friends.length > 0 && (
          <ul className="grid gap-1.5">
            {me.friends.map((friend, index) => (
              <li
                key={`${friend.name}-${index}`}
                className="flex items-center gap-2 rounded-control bg-surface-2 py-1 pr-1 pl-3"
              >
                <span className="min-w-0 flex-1 truncate">{friend.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setFriends(
                      me.friends.map((item, i) =>
                        i === index ? { ...item, status: !item.status } : item,
                      ),
                    )
                  }
                  className={cn(
                    'h-11 rounded-full px-3.5 text-sm font-medium transition-colors duration-150',
                    friend.status
                      ? 'bg-accent-soft text-ink'
                      : 'border border-dashed border-line text-muted',
                  )}
                  aria-label={`${friend.name}: ${friend.status ? 'точно идёт' : 'возможно'}, изменить`}
                >
                  {friend.status ? 'точно' : 'возможно'}
                </button>
                <IconButton
                  label={`Убрать ${friend.name}`}
                  disabled={pending}
                  onClick={() =>
                    setFriends(me.friends.filter((_, i) => i !== index))
                  }
                >
                  <X className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        <AddFriend
          disabled={pending || me.friends.length >= 20}
          onAdd={(friend) => setFriends([...me.friends, friend])}
        />
      </div>

      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
    </section>
  );
}

function AddFriend({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (friend: Friend) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>('sure');

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="justify-self-start"
        icon={<UserPlus className="size-5" aria-hidden />}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Привести друга
      </Button>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, status: status === 'sure' });
    setName('');
    setOpen(false);
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor="friend-name" className="sr-only">
        Имя друга
      </label>
      <div className="flex gap-2">
        <input
          id="friend-name"
          autoFocus
          maxLength={50}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Имя друга"
          className="h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3.5 text-base focus:border-accent focus:ring-3 focus:ring-accent/30 focus:outline-none"
        />
        <Button
          type="submit"
          icon={<Plus className="size-4" weight="bold" aria-hidden />}
        >
          Добавить
        </Button>
      </div>
      <Segmented
        label="Друг придёт"
        value={status}
        options={STATUS_OPTIONS}
        onChange={setStatus}
      />
    </form>
  );
}
