import { html, joinHtml, type Html } from '@dirai/tg-kit';
import type { DailyForecast } from '@football-planner/shared';

import type { RosterPerson } from '../../modules/players/count.js';

export type NotifyFriend = { name: string; status: boolean };

export type NotifyPlayer = {
  name: string;
  status: boolean;
  friends: NotifyFriend[];
};

export type NotifyEvent = {
  _id: string;
  eventName: string;
  date: string;
  time: string;
  place: string;
  minimum: number;
  /** Places on the pitch; 0 or missing: no limit */
  maximum?: number;
};

export type PlayersCount = {
  all: number;
  exactly: number;
  maybe: number;
  waiting?: number;
};

export type PlayersChangeKind = 'added' | 'updated' | 'removed';

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** "вт, 3 ноября · 20:00" */
export const formatWhen = ({
  date,
  time,
}: Pick<NotifyEvent, 'date' | 'time'>) => {
  const [year, month, day] = date.split('-').map(Number);
  const formatted =
    year && month && day
      ? dayFormat.format(new Date(Date.UTC(year, month - 1, day)))
      : date;
  return `${formatted} · ${time}`;
};

const PROGRESS_CELLS = 10;

/** "▰▰▰▰▰▰▰▱▱▱" — sure players against the minimum */
export const progressBar = (exactly: number, minimum: number) => {
  const filled = Math.min(
    PROGRESS_CELLS,
    Math.round((exactly / minimum) * PROGRESS_CELLS),
  );
  return '▰'.repeat(filled) + '▱'.repeat(PROGRESS_CELLS - filled);
};

/** Names in one place of the roster, friends with the player who brought them */
const namesIn = (people: RosterPerson[], place: RosterPerson['place']) =>
  people
    .filter((person) => person.place === place)
    .map((person) =>
      person.from ? `${person.name} (от ${person.from})` : person.name,
    );

const progressLine = (count: PlayersCount, event: NotifyEvent) => {
  const places = event.maximum ? ` · мест ${event.maximum}` : '';
  return event.minimum > 0
    ? html`👥 <b>${count.exactly}</b> из ${event.minimum}  ${progressBar(count.exactly, event.minimum)}${places}`
    : html`👥 Точно идут: <b>${count.exactly}</b>${places}`;
};

const missingLine = (count: PlayersCount, minimum: number) => {
  if (minimum <= 0) return null;
  const missing = minimum - count.exactly;
  return missing > 0
    ? html`<i>Нужно ещё ${missing}</i>`
    : html`🎉 <b>Минимум набран</b>`;
};

// Telegram rejects messages over 4096 characters; leave room for markup and edits
export const MAX_MESSAGE_LENGTH = 4000;

/** "Аня, Боб и ещё 12" — the first `limit` names */
const nameList = (names: string[], limit: number) =>
  names.length > limit
    ? `${names.slice(0, limit).join(', ')} и ещё ${names.length - limit}`
    : names.join(', ');

/** The pinned message of a match, edited on every change of the players list */
export const announcementMessage = (
  event: NotifyEvent,
  people: RosterPerson[],
  count: PlayersCount,
): Html => {
  const sure = namesIn(people, 'squad');
  const maybe = namesIn(people, 'maybe');
  const waiting = namesIn(people, 'waiting');

  const render = (limit: number) =>
    joinHtml([
      html`⚽ <b>${event.eventName}</b>`,
      html`📅 ${formatWhen(event)}`,
      html`📍 ${event.place}`,
      '',
      progressLine(count, event),
      html`✅ Точно: ${sure.length ? nameList(sure, limit) : 'пока никого'}`,
      maybe.length > 0 && html`🤔 Возможно: ${nameList(maybe, limit)}`,
      waiting.length > 0 && html`⏳ Лист ожидания: ${nameList(waiting, limit)}`,
      missingLine(count, event.minimum),
    ]);

  // Shorten the lists until the message fits
  let limit = Math.max(sure.length, maybe.length, waiting.length);
  let message = render(limit);
  while (message.value.length > MAX_MESSAGE_LENGTH && limit > 0) {
    limit = Math.floor(limit / 2);
    message = render(limit);
  }
  return message;
};

export const cancelledAnnouncementMessage = (event: NotifyEvent) =>
  joinHtml([
    html`❌ <s>${event.eventName}</s>`,
    html`📅 <s>${formatWhen(event)}</s>`,
    html`<b>Матч отменён</b>`,
  ]);

export const cancelledMessage = (event: NotifyEvent) =>
  html`❌ Матч <b>${event.eventName}</b> (${formatWhen(event)}) отменён`;

const friendsSuffix = (player: NotifyPlayer) =>
  player.friends.length > 0
    ? ` (+${player.friends.map((friend) => friend.name).join(', ')})`
    : '';

const score = (count: PlayersCount, minimum: number) =>
  minimum > 0 ? `${count.exactly}/${minimum}` : `${count.exactly}`;

/** Short, silent note about a change; the details live in the pinned announcement */
export const playersChangeMessage = (
  kind: PlayersChangeKind,
  player: NotifyPlayer,
  event: NotifyEvent,
  count: PlayersCount,
  waitlisted = false,
): Html => {
  const name = html`<b>${player.name}</b>${friendsSuffix(player)}`;
  const where = html`«${event.eventName}» · ${score(count, event.minimum)}`;

  if (kind === 'removed') return html`❌ ${name} не пойдёт на ${where}`;
  if (kind === 'updated') return html`✏️ ${name} изменил запись на ${where}`;
  if (waitlisted) return html`⏳ ${name} в листе ожидания на ${where}`;
  return player.status
    ? html`✅ ${name} идёт на ${where}`
    : html`🤔 ${name}, возможно, придёт на ${where}`;
};

/** Who got a place and who lost one, e.g. after someone left or the places changed */
export const squadChangedMessage = (
  event: NotifyEvent,
  promoted: string[],
  demoted: string[],
) =>
  joinHtml([
    promoted.length > 0 &&
      html`🎉 Из листа ожидания в состав: <b>${promoted.join(', ')}</b>`,
    demoted.length > 0 &&
      html`⏳ Мест стало меньше, в лист ожидания: <b>${demoted.join(', ')}</b>`,
    html`«${event.eventName}», ${formatWhen(event)}`,
  ]);

export type ReminderKind = 'day' | 'soon';

const forecastLine = (forecast: DailyForecast | null) => {
  if (!forecast) return null;
  const temp =
    Math.round(forecast.tempMin) === Math.round(forecast.tempMax)
      ? `${Math.round(forecast.tempMax)}°`
      : `${Math.round(forecast.tempMin)}…${Math.round(forecast.tempMax)}°`;
  const rain =
    forecast.precipitationProbability !== null &&
    forecast.precipitationProbability >= 30
      ? `, осадки ${forecast.precipitationProbability}%`
      : '';
  return html`🌤 ${forecast.description}, ${temp}${rain}`;
};

/** The day before and two hours before the start, with the score and the weather */
export const reminderMessage = (
  kind: ReminderKind,
  event: NotifyEvent,
  count: PlayersCount,
  forecast: DailyForecast | null,
  /** For the day-before reminder: whether the match is today or tomorrow at the venue */
  day: 'today' | 'tomorrow' = 'tomorrow',
) =>
  joinHtml([
    kind === 'soon'
      ? html`⏰ Скоро начало: <b>${event.eventName}</b>`
      : day === 'today'
        ? html`⏰ Сегодня матч <b>${event.eventName}</b>`
        : html`⏰ Завтра матч <b>${event.eventName}</b>`,
    html`📅 ${formatWhen(event)} · 📍 ${event.place}`,
    progressLine(count, event),
    missingLine(count, event.minimum),
    forecastLine(forecast),
  ]);

export const minimumReachedMessage = (
  event: NotifyEvent,
  count: PlayersCount,
) =>
  html`🎉 На <b>${event.eventName}</b> набрался минимум: ${count.exactly} игроков. ${formatWhen(event)}, ${event.place}`;

export const eventChangedMessage = (event: NotifyEvent) =>
  joinHtml([
    html`✏️ Матч <b>${event.eventName}</b> изменён`,
    html`📅 ${formatWhen(event)}`,
    html`📍 ${event.place}`,
  ]);

export type RsvpAction = 'yes' | 'maybe' | 'no' | 'friend';

/** Sign-up buttons under announcements and reminders, and a link to the match page */
/**
 * Where "Открыть" leads: the Mini App when it is set up (`startapp` carries the match),
 * otherwise the site
 */
export const matchLink = (
  eventId: string,
  { publicUrl, appUrl }: { publicUrl?: string; appUrl?: string },
) =>
  appUrl
    ? `${appUrl}?startapp=${eventId}`
    : publicUrl && `${publicUrl}/events/${eventId}`;

export const rsvpKeyboard = (event: NotifyEvent, openUrl?: string) => {
  const button = (text: string, action: RsvpAction) => ({
    text,
    callback_data: `rsvp:${event._id}:${action}`,
  });
  return {
    inline_keyboard: [
      [
        button('✅ Иду', 'yes'),
        button('🤔 Возможно', 'maybe'),
        button('❌ Не иду', 'no'),
      ],
      [
        button('➕ Друг', 'friend'),
        ...(openUrl ? [{ text: '🔗 Открыть', url: openUrl }] : []),
      ],
    ],
  };
};
