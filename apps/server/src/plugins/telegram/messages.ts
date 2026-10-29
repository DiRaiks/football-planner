import { html, joinHtml, type Html } from '@dirai-kit/tg';
import {
  shareOf,
  type Forecast,
  type PriceMode,
} from '@football-planner/shared';

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
  /** Whole roubles, 0 or missing: free */
  price?: number;
  priceMode?: PriceMode;
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

/** Weather worth a warning: a likely rain or snow, or a thunderstorm (WMO 95–99) */
export const isRainy = (forecast: Forecast | null) =>
  !!forecast &&
  ((forecast.precipitationProbability ?? 0) >= 60 ||
    forecast.weatherCode >= 95);

/** The weather at the start: "🌤 Пасмурно, 12°, осадки 40%", stressed when rainy */
const forecastLine = (forecast: Forecast | null) => {
  if (!forecast) return null;
  const temp = `${Math.round(forecast.temperature)}°`;
  const chance = forecast.precipitationProbability;
  if (isRainy(forecast)) {
    const icon = forecast.weatherCode >= 95 ? '⛈' : '☔';
    const rain = chance !== null && chance > 0 ? `, осадки ${chance}%` : '';
    return html`${icon} <b>${forecast.description}${rain}</b>, ${temp}`;
  }
  const rain = chance !== null && chance >= 30 ? `, осадки ${chance}%` : '';
  return html`🌤 ${forecast.description}, ${temp}${rain}`;
};

const rub = new Intl.NumberFormat('ru-RU');

/** "💰 ~460 ₽ с человека (поле 5 000 ₽ на 11)", recounted with the squad */
const priceLine = (event: NotifyEvent, count: PlayersCount) => {
  const price = event.price ?? 0;
  if (price <= 0) return null;
  if (event.priceMode !== 'pitch')
    return html`💰 ${rub.format(price)} ₽ с человека`;
  const share = shareOf(price, 'pitch', count.exactly);
  return share === null
    ? html`💰 Поле ${rub.format(price)} ₽, делим на всех, кто точно идёт`
    : html`💰 ~${rub.format(share)} ₽ с человека (поле ${rub.format(price)} ₽ на ${count.exactly})`;
};

/**
 * The pinned message of a match, edited on every change of the players list; the
 * weather at the start once the match is within the forecast window
 */
export const announcementMessage = (
  event: NotifyEvent,
  people: RosterPerson[],
  count: PlayersCount,
  forecast: Forecast | null = null,
): Html => {
  const sure = namesIn(people, 'squad');
  const maybe = namesIn(people, 'maybe');
  const waiting = namesIn(people, 'waiting');

  const render = (limit: number) =>
    joinHtml([
      html`⚽ <b>${event.eventName}</b>`,
      html`📅 ${formatWhen(event)}`,
      html`📍 ${event.place}`,
      forecastLine(forecast),
      priceLine(event, count),
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

export const cancelledMessage = (event: NotifyEvent, reason?: string) =>
  reason
    ? html`❌ Матч <b>${event.eventName}</b> (${formatWhen(event)}) отменён: ${reason}`
    : html`❌ Матч <b>${event.eventName}</b> (${formatWhen(event)}) отменён`;

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

const TEAM_MARKS = ['🟢', '🔵', '🟠', '🟣'];

/** The teams the organiser split, one line per team */
export const teamsMessage = (event: NotifyEvent, teams: string[][]) =>
  joinHtml([
    html`⚽ Составы на «${event.eventName}», ${formatWhen(event)}`,
    ...teams.map(
      (team, index) =>
        html`${TEAM_MARKS[index] ?? '⚪'} <b>Команда ${index + 1}</b> (${team.length}): ${team.join(', ')}`,
    ),
  ]);

export type ReminderKind = 'day' | 'soon';

/** The day before and two hours before the start, with the score and the weather */
export const reminderMessage = (
  kind: ReminderKind,
  event: NotifyEvent,
  count: PlayersCount,
  forecast: Forecast | null,
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

/** At the sign-up deadline, when the minimum is not reached */
export const deadlineMessage = (
  event: NotifyEvent,
  count: PlayersCount,
  hoursLeft: number,
) =>
  joinHtml([
    html`⚠️ <b>Не набираемся</b> на <b>${event.eventName}</b>: ${count.exactly} из ${event.minimum}, до начала ${hoursLeft} ч`,
    html`📅 ${formatWhen(event)} · 📍 ${event.place}`,
    missingLine(count, event.minimum),
  ]);

/** The forecast turned rainy after the day-before reminder */
export const rainMessage = (event: NotifyEvent, forecast: Forecast) =>
  joinHtml([
    html`☔ Прогноз испортился: <b>${event.eventName}</b>, ${formatWhen(event)}`,
    forecastLine(forecast),
  ]);

/** After the match: who has not been marked as paid yet */
export const paymentReminderMessage = (
  event: NotifyEvent,
  count: PlayersCount,
  unpaid: string[],
) =>
  joinHtml([
    html`💰 Оплата за <b>${event.eventName}</b> (${formatWhen(event)})`,
    html`Не отметили оплату: ${nameList(unpaid, 30)}`,
    priceLine(event, count),
    html`<i>Куда переводить — на странице матча</i>`,
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
