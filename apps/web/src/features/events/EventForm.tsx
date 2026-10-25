import { useState, type FormEvent } from 'react';
import type { CreateEventBody, Event } from '@football-planner/shared';
import { Minus, Plus } from '@phosphor-icons/react';

import { Button, ErrorNote, Field, IconButton } from '@/components/ui';
import { todayIso } from '@/lib/format';

type Values = Omit<CreateEventBody, 'location'>;
type Errors = Partial<Record<keyof Values, string>>;

const validate = (values: Values): Errors => {
  const errors: Errors = {};
  if (!values.eventName.trim()) errors.eventName = 'Как назовём матч?';
  if (!values.place.trim()) errors.place = 'Где играем?';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.date = 'Выберите дату';
  if (!/^\d{2}:\d{2}$/.test(values.time)) errors.time = 'Выберите время';
  return errors;
};

export function EventForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Event;
  submitLabel: string;
  pending: boolean;
  error?: string | null;
  onSubmit: (values: Values) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>({
    eventName: initial?.eventName ?? '',
    place: initial?.place ?? '',
    date: initial?.date ?? todayIso(),
    time: initial?.time ?? '20:00',
    minimum: initial?.minimum ?? 10,
  });
  const [errors, setErrors] = useState<Errors>({});

  const set =
    <K extends keyof Values>(key: K) =>
    (value: Values[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
    };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      ...values,
      eventName: values.eventName.trim(),
      place: values.place.trim(),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field
        label="Название"
        placeholder="Вторничный футбол"
        maxLength={100}
        value={values.eventName}
        onChange={(event) => set('eventName')(event.target.value)}
        error={errors.eventName}
      />
      <Field
        label="Место"
        placeholder="Стадион «Динамо», поле 2"
        maxLength={200}
        value={values.place}
        onChange={(event) => set('place')(event.target.value)}
        error={errors.place}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Дата"
          type="date"
          value={values.date}
          onChange={(event) => set('date')(event.target.value)}
          error={errors.date}
        />
        <Field
          label="Время"
          type="time"
          value={values.time}
          onChange={(event) => set('time')(event.target.value)}
          error={errors.time}
        />
      </div>

      <div className="grid gap-1.5">
        <span id="minimum-label" className="text-sm font-medium">
          Минимум игроков
        </span>
        <div
          role="group"
          aria-labelledby="minimum-label"
          className="flex items-center gap-2 justify-self-start rounded-control border border-line bg-surface p-1"
        >
          <IconButton
            label="Меньше"
            disabled={values.minimum <= 0}
            onClick={() => set('minimum')(Math.max(0, values.minimum - 1))}
          >
            <Minus className="size-4" weight="bold" aria-hidden />
          </IconButton>
          <output
            aria-live="polite"
            className="w-10 text-center font-mono text-xl tabular-nums"
          >
            {values.minimum}
          </output>
          <IconButton
            label="Больше"
            disabled={values.minimum >= 100}
            onClick={() => set('minimum')(Math.min(100, values.minimum + 1))}
          >
            <Plus className="size-4" weight="bold" aria-hidden />
          </IconButton>
        </div>
        <p className="text-sm text-muted">
          Когда наберётся столько точно идущих, бот сообщит в чат.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {submitLabel}
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
