import { html, joinHtml, type Html } from '@dirai/tg-kit';

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
};

export type PlayersCount = { all: number; exactly: number; maybe: number };

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

/** Everyone who signed up, friends listed after the player who brought them */
const roster = (players: NotifyPlayer[], status: boolean) =>
  players.flatMap((player) => [
    ...(player.status === status ? [player.name] : []),
    ...player.friends
      .filter((friend) => friend.status === status)
      .map((friend) => `${friend.name} (от ${player.name})`),
  ]);

const progressLine = (count: PlayersCount, minimum: number) =>
  minimum > 0
    ? html`👥 <b>${count.exactly}</b> из ${minimum}  ${progressBar(count.exactly, minimum)}`
    : html`👥 Точно идут: <b>${count.exactly}</b>`;

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
  players: NotifyPlayer[],
  count: PlayersCount,
): Html => {
  const sure = roster(players, true);
  const maybe = roster(players, false);

  const render = (limit: number) =>
    joinHtml([
      html`⚽ <b>${event.eventName}</b>`,
      html`📅 ${formatWhen(event)}`,
      html`📍 ${event.place}`,
      '',
      progressLine(count, event.minimum),
      html`✅ Точно: ${sure.length ? nameList(sure, limit) : 'пока никого'}`,
      maybe.length > 0 && html`🤔 Возможно: ${nameList(maybe, limit)}`,
      missingLine(count, event.minimum),
    ]);

  // Shorten the lists until the message fits
  let limit = Math.max(sure.length, maybe.length);
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
): Html => {
  const name = html`<b>${player.name}</b>${friendsSuffix(player)}`;
  const where = html`«${event.eventName}» · ${score(count, event.minimum)}`;

  if (kind === 'removed') return html`❌ ${name} не пойдёт на ${where}`;
  if (kind === 'updated') return html`✏️ ${name} изменил запись на ${where}`;
  return player.status
    ? html`✅ ${name} идёт на ${where}`
    : html`🤔 ${name}, возможно, придёт на ${where}`;
};

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

/** "Sign up" button under the announcement; only when the site URL is known */
export const signUpKeyboard = (event: NotifyEvent, publicUrl?: string) =>
  publicUrl
    ? {
        inline_keyboard: [
          [{ text: 'Записаться', url: `${publicUrl}/events/${event._id}` }],
        ],
      }
    : undefined;
