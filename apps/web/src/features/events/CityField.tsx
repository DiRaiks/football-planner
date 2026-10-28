import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import type { City, Location } from '@football-planner/shared';

import { Field, cn } from '@/components/ui';
import { useCities, useDefaultLocation } from '@/features/weather/api';

/** The text settles before a search goes out */
const useDebounced = (value: string, ms = 250) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
};

/**
 * The city of the match, for its weather: typed and picked from suggestions (an ARIA
 * combobox). Only a picked city counts; an empty field means the default city.
 */
export function CityField({
  text,
  location,
  error,
  onTextChange,
  onPick,
}: {
  text: string;
  location: Location | null;
  error?: string;
  onTextChange: (text: string) => void;
  onPick: (location: Location) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(text);
  const { data: cities = [] } = useCities(query);
  const { data: defaults } = useDefaultLocation();

  // Suggestions only while typing something that is not the picked city
  const shown = open && text.trim().length >= 2 && cities.length > 0;
  const fallback = defaults?.location;

  const pick = (city: City) => {
    onPick({ lat: city.lat, lon: city.lon, name: city.name });
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!shown) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + cities.length) % cities.length);
    } else if (event.key === 'Enter') {
      const city = cities[active];
      if (city) {
        event.preventDefault();
        pick(city);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const hint = location
    ? 'Погода будет для этого города'
    : fallback?.name
      ? `Для погоды. Если не выбрать — ${fallback.name}`
      : 'Для прогноза погоды';

  return (
    <div className="grid gap-1.5">
      <Field
        label="Город"
        placeholder={fallback?.name ?? 'Начните вводить название'}
        maxLength={100}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        value={text}
        onChange={(event) => {
          onTextChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        hint={hint}
        error={error}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Города"
          className="grid overflow-hidden rounded-control border border-line bg-surface shadow-panel"
        >
          {cities.map((city, index) => (
            <li
              key={`${city.lat},${city.lon}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault();
                pick(city);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                'grid cursor-pointer gap-0.5 px-3.5 py-2.5',
                index === active && 'bg-surface-2',
              )}
            >
              <span>{city.name}</span>
              {city.region && (
                <span className="text-xs text-muted">{city.region}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
