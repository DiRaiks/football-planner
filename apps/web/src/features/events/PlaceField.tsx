import { useId, useState, type KeyboardEvent } from 'react';
import type { SavedPlace } from '@football-planner/shared';

import { Field, cn } from '@/components/ui';
import { usePlaces } from './api';

const MAX_SHOWN = 6;

/** Saved places that contain the typed text, minus the one already typed in full */
export const matchPlaces = (places: SavedPlace[], text: string) => {
  const query = text.trim().toLowerCase();
  return places
    .filter(({ place }) => {
      const name = place.toLowerCase();
      return name.includes(query) && name !== query;
    })
    .slice(0, MAX_SHOWN);
};

/**
 * Where the match is played: free text, with places of past matches suggested (an ARIA
 * combobox). Picking one also brings its city, so the weather needs no second step.
 */
export function PlaceField({
  value,
  error,
  onChange,
  onPick,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onPick: (place: SavedPlace) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { data: places = [] } = usePlaces();

  const options = matchPlaces(places, value);
  const shown = open && options.length > 0;

  const pick = (place: SavedPlace) => {
    onPick(place);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!shown) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      const place = options[active];
      if (place) {
        event.preventDefault();
        pick(place);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="grid gap-1.5">
      <Field
        label="Место"
        placeholder="Стадион «Динамо», поле 2"
        maxLength={200}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        hint={
          places.length > 0 ? 'Можно выбрать из мест прошлых матчей' : undefined
        }
        error={error}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Места прошлых матчей"
          className="grid overflow-hidden rounded-control border border-line bg-surface shadow-panel"
        >
          {options.map((place, index) => (
            <li
              key={place.place}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault();
                pick(place);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                'grid cursor-pointer gap-0.5 px-3.5 py-2.5',
                index === active && 'bg-surface-2',
              )}
            >
              <span>{place.place}</span>
              {place.location?.name && (
                <span className="text-xs text-muted">
                  {place.location.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
