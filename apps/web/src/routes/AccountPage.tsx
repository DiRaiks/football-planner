import { useState, type FormEvent } from 'react';
import {
  Desktop,
  Moon,
  SignOut,
  Sun,
  TelegramLogo,
} from '@phosphor-icons/react';

import { Button, ErrorNote, Field, Segmented } from '@/components/ui';
import {
  useChangePassword,
  useTelegramLink,
  useUnlinkTelegram,
  useUpdateMe,
  useUserStats,
} from '@/features/account/api';
import { useAuth, useUser } from '@/features/auth/auth';
import { errorMessage } from '@/lib/api';
import { plural } from '@/lib/format';
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from '@/lib/theme';

const THEME_OPTIONS = [
  {
    value: 'system' as const,
    label: 'Системная',
    icon: <Desktop className="size-4" aria-hidden />,
  },
  {
    value: 'light' as const,
    label: 'Светлая',
    icon: <Sun className="size-4" aria-hidden />,
  },
  {
    value: 'dark' as const,
    label: 'Тёмная',
    icon: <Moon className="size-4" aria-hidden />,
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-panel bg-surface p-5 shadow-panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function AccountPage() {
  const user = useUser();
  const { logout } = useAuth();
  const stats = useUserStats(user._id);
  const theme = useThemePreference();

  return (
    <div className="mx-auto grid max-w-lg gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{user.name}</h1>
        {user.email && <p className="text-muted">{user.email}</p>}
      </div>

      {stats.data && (
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-semibold tabular-nums">
            {stats.data.eventsCount}
          </span>
          <span className="text-muted">
            {plural(stats.data.eventsCount, ['матч', 'матча', 'матчей'])} в
            записи
          </span>
        </p>
      )}

      <NameForm initial={user.name} />
      <TelegramSection linked={user.telegramLinked} hasEmail={!!user.email} />
      {user.email && <PasswordForm />}

      <Section title="Тема">
        <Segmented<ThemePreference>
          label="Тема оформления"
          value={theme}
          options={THEME_OPTIONS}
          onChange={setThemePreference}
        />
      </Section>

      <Button
        variant="ghost"
        className="justify-self-start"
        icon={<SignOut className="size-5" aria-hidden />}
        onClick={logout}
      >
        Выйти
      </Button>
    </div>
  );
}

/**
 * Linking Telegram: the account then sees sign-ups made with the bot's buttons, and
 * the bot can write when a place frees up
 */
function TelegramSection({
  linked,
  hasEmail,
}: {
  linked: boolean;
  hasEmail: boolean;
}) {
  const link = useTelegramLink();
  const unlink = useUnlinkTelegram();

  if (linked) {
    return (
      <Section title="Telegram">
        <p className="text-pretty text-muted">
          Привязан: записи кнопками в чате видны здесь, а бот пишет вам, когда
          освобождается место.
        </p>
        {hasEmail && (
          <Button
            variant="secondary"
            className="justify-self-start"
            loading={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            Отвязать
          </Button>
        )}
        {unlink.error && <ErrorNote>{errorMessage(unlink.error)}</ErrorNote>}
      </Section>
    );
  }

  return (
    <Section title="Telegram">
      <p className="text-pretty text-muted">
        Записывайтесь кнопками прямо в чате, а сайт покажет те же записи.
      </p>
      {link.data ? (
        <div className="grid gap-3">
          <p>Отправьте боту в личные сообщения в течение 15 минут:</p>
          <code className="justify-self-start rounded-control bg-surface-2 px-3 py-2 font-mono text-lg tracking-wider select-all">
            /link {link.data.code}
          </code>
          <a
            href={link.data.botUrl}
            target="_blank"
            rel="noreferrer"
            className="justify-self-start font-medium underline underline-offset-4"
          >
            Открыть бота
          </a>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="justify-self-start"
          icon={<TelegramLogo className="size-5" aria-hidden />}
          loading={link.isPending}
          onClick={() => link.mutate()}
        >
          Привязать Telegram
        </Button>
      )}
      {link.error && <ErrorNote>{errorMessage(link.error)}</ErrorNote>}
    </Section>
  );
}

function NameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const update = useUpdateMe();
  const changed = name.trim() !== initial && name.trim().length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (changed) update.mutate({ name: name.trim() });
  };

  return (
    <Section title="Имя">
      <form onSubmit={submit} className="grid gap-3">
        <Field
          label="Как подписывать в составе"
          maxLength={50}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {update.error && <ErrorNote>{errorMessage(update.error)}</ErrorNote>}
        <Button
          type="submit"
          variant="secondary"
          className="justify-self-start"
          disabled={!changed}
          loading={update.isPending}
        >
          {update.isSuccess && !changed ? 'Сохранено' : 'Сохранить'}
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const change = useChangePassword();
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword || newPassword.length < 8) return;
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrent('');
          setNew('');
        },
      },
    );
  };

  return (
    <Section title="Пароль">
      <form onSubmit={submit} className="grid gap-3">
        <Field
          label="Текущий пароль"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <Field
          label="Новый пароль"
          type="password"
          autoComplete="new-password"
          hint="Минимум 8 символов. Другие устройства выйдут из аккаунта."
          error={tooShort ? 'Минимум 8 символов' : undefined}
          value={newPassword}
          onChange={(event) => setNew(event.target.value)}
        />
        {change.error && <ErrorNote>{errorMessage(change.error)}</ErrorNote>}
        {change.isSuccess && (
          <p className="text-sm text-muted">Пароль изменён.</p>
        )}
        <Button
          type="submit"
          variant="secondary"
          className="justify-self-start"
          disabled={!currentPassword || newPassword.length < 8}
          loading={change.isPending}
        >
          Сменить пароль
        </Button>
      </form>
    </Section>
  );
}
