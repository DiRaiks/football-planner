import { useState, type FormEvent } from 'react';
import type {
  CreateEventBody,
  Event,
  Location,
} from '@football-planner/shared';
import { Minus, Plus } from '@phosphor-icons/react';

import {
  Button,
  ErrorNote,
  Field,
  IconButton,
  Segmented,
} from '@/components/ui';
import { todayIso } from '@/lib/format';
import { CityField } from './CityField';
import { PlaceField } from './PlaceField';
import { randomMatchName } from './match-names';

type Values = Omit<CreateEventBody, 'location'>;
type Errors = Partial<Record<keyof Values | 'location', string>>;
/** What the form submits: no city (null) means the default one */
export type EventFormValues = Values & { location: Location | null };

const validate = (values: Values): Errors => {
  const errors: Errors = {};
  if (!values.eventName.trim()) errors.eventName = 'Как назовём матч?';
  if (!values.place.trim()) errors.place = 'Где играем?';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.date = 'Выберите дату';
  if (!/^\d{2}:\d{2}$/.test(values.time)) errors.time = 'Выберите время';
  const maximum = values.maximum ?? 0;
  if (maximum > 0 && maximum < values.minimum) {
    errors.maximum = 'Мест не может быть меньше минимума';
  }
  const price = values.price ?? 0;
  if (!Number.isInteger(price) || price < 0 || price > 100_000) {
    errors.price = 'Цена — целое число рублей до 100 000';
  }
  return errors;
};

/** A number with − and + buttons, for counts of players */
function Stepper({
  id,
  label,
  value,
  onChange,
  display,
  hint,
  error,
  step,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  display?: string;
  hint: string;
  error?: string;
  /** The next value up or down; one step by default */
  step?: (value: number, direction: 1 | -1) => number;
}) {
  const move = (direction: 1 | -1) =>
    onChange(
      Math.min(
        100,
        Math.max(0, step ? step(value, direction) : value + direction),
      ),
    );
  return (
    <div className="grid gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        className="flex items-center gap-2 justify-self-start rounded-control border border-line bg-surface p-1"
      >
        <IconButton
          label={`Меньше: ${label.toLowerCase()}`}
          disabled={value <= 0}
          onClick={() => move(-1)}
        >
          <Minus className="size-4" weight="bold" aria-hidden />
        </IconButton>
        <output
          aria-live="polite"
          className="min-w-10 px-1 text-center font-mono text-xl tabular-nums"
        >
          {display ?? value}
        </output>
        <IconButton
          label={`Больше: ${label.toLowerCase()}`}
          disabled={value >= 100}
          onClick={() => move(1)}
        >
          <Plus className="size-4" weight="bold" aria-hidden />
        </IconButton>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="text-sm text-pretty text-muted">{hint}</p>
      )}
    </div>
  );
}

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
  onSubmit: (values: EventFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => ({
    // A new match starts with a fun name, ready to keep or change
    eventName: initial?.eventName ?? randomMatchName(),
    place: initial?.place ?? '',
    date: initial?.date ?? todayIso(),
    time: initial?.time ?? '20:00',
    minimum: initial?.minimum ?? 10,
    maximum: initial?.maximum ?? 0,
    repeat: initial?.repeat ?? 'none',
    price: initial?.price ?? 0,
  }));
  // The city as typed; the location changes only when a city is picked
  const [location, setLocation] = useState<Location | null>(
    initial?.location ?? null,
  );
  const [cityText, setCityText] = useState(
    initial?.location ? (initial.location.name ?? 'Точка на карте') : '',
  );
  // The price as typed, so an empty field stays empty while editing
  const [priceText, setPriceText] = useState(
    initial?.price ? String(initial.price) : '',
  );
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
    if (cityText.trim() && !location) {
      found.location = 'Выберите город из подсказок или очистите поле';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      ...values,
      eventName: values.eventName.trim(),
      place: values.place.trim(),
      location: cityText.trim() ? location : null,
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
      <PlaceField
        value={values.place}
        error={errors.place}
        onChange={set('place')}
        onPick={(saved) => {
          set('place')(saved.place);
          // A place without a city keeps whatever city is in the form
          if (saved.location) {
            setLocation(saved.location);
            setCityText(saved.location.name ?? 'Точка на карте');
            setErrors((current) => ({ ...current, location: undefined }));
          }
        }}
      />
      <CityField
        text={cityText}
        location={location}
        error={errors.location}
        onTextChange={(text) => {
          setCityText(text);
          setLocation(null);
          setErrors((current) => ({ ...current, location: undefined }));
        }}
        onPick={(picked) => {
          setLocation(picked);
          setCityText(picked.name ?? '');
        }}
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

      <Stepper
        id="minimum"
        label="Минимум игроков"
        value={values.minimum}
        onChange={set('minimum')}
        hint="Когда наберётся столько точно идущих, бот сообщит в чат."
      />
      <Stepper
        id="maximum"
        label="Мест на поле"
        value={values.maximum ?? 0}
        onChange={set('maximum')}
        display={values.maximum ? String(values.maximum) : '∞'}
        // No limit and the minimum are neighbours: fewer places than the minimum make no sense
        step={(value, direction) =>
          direction === 1
            ? value === 0
              ? Math.max(values.minimum, 1)
              : value + 1
            : value - 1 < values.minimum
              ? 0
              : value - 1
        }
        hint="Кто запишется сверх, встанет в лист ожидания и попадёт в состав, когда место освободится. ∞ — без ограничения."
        error={errors.maximum}
      />

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Повтор</span>
        <Segmented
          label="Повтор"
          className="justify-self-start"
          value={values.repeat ?? 'none'}
          onChange={set('repeat')}
          options={[
            { value: 'none', label: 'Один раз' },
            { value: 'weekly', label: 'Каждую неделю' },
          ]}
        />
        <p className="text-sm text-pretty text-muted">
          {values.repeat === 'weekly'
            ? 'Когда матч начнётся, такой же появится через неделю, и бот объявит его в чате.'
            : 'Матч пройдёт один раз.'}
        </p>
      </div>

      <Field
        label="Цена с человека, ₽"
        inputMode="numeric"
        placeholder="0 — бесплатно"
        className="max-w-60"
        value={priceText}
        onChange={(event) => {
          const text = event.target.value.replace(/\D/g, '').slice(0, 6);
          setPriceText(text);
          set('price')(text ? Number(text) : 0);
        }}
        hint="Организатор отмечает в составе, кто заплатил."
        error={errors.price}
      />

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
