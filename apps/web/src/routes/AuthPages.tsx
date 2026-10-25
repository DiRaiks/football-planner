import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { Button, ErrorNote, Field } from '@/components/ui';
import { useAuth } from '@/features/auth/auth';
import { errorMessage } from '@/lib/api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim()) || !password) {
      setError('Введите почту и пароль');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
        <p className="text-muted">
          Чтобы записываться на матчи и звать друзей.
        </p>
      </div>
      <Field
        label="Почта"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label="Пароль"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" size="lg" loading={pending}>
        Войти
      </Button>
      <p className="text-center text-sm text-muted">
        Впервые здесь?{' '}
        <Link
          to="/register"
          className="font-medium text-ink underline underline-offset-4"
        >
          Создать аккаунт
        </Link>
      </p>
    </form>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = {
      name: name.trim() ? undefined : 'Как вас подписать в составе?',
      email: EMAIL.test(email.trim()) ? undefined : 'Проверьте почту',
      password: password.length >= 8 ? undefined : 'Минимум 8 символов',
    };
    setErrors(found);
    if (found.name || found.email || found.password) return;

    setPending(true);
    setError(null);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Регистрация</h1>
        <p className="text-muted">Имя увидят в составе и в чате.</p>
      </div>
      <Field
        label="Имя"
        autoComplete="name"
        maxLength={50}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <Field
        label="Почта"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />
      <Field
        label="Пароль"
        type="password"
        autoComplete="new-password"
        hint="Минимум 8 символов"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.password}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" size="lg" loading={pending}>
        Создать аккаунт
      </Button>
      <p className="text-center text-sm text-muted">
        Уже есть аккаунт?{' '}
        <Link
          to="/login"
          className="font-medium text-ink underline underline-offset-4"
        >
          Войти
        </Link>
      </p>
    </form>
  );
}
