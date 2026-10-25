import { Type, type Static } from 'typebox';

export const ObjectId = Type.String({ pattern: '^[a-fA-F0-9]{24}$' });

export const ErrorResponse = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

// --- Users & auth ---

export const UserRole = Type.Union([
  Type.Literal('user'),
  Type.Literal('admin'),
]);

export const User = Type.Object({
  _id: Type.String(),
  // Missing for people who only used the bot's buttons in Telegram
  email: Type.Optional(Type.String()),
  name: Type.String(),
  role: UserRole,
  telegramLinked: Type.Boolean(),
});

/** A one-time code to send to the bot as `/link CODE`, valid for 15 minutes */
export const TelegramLink = Type.Object({
  code: Type.String(),
  botUrl: Type.String(),
});

export const PublicUser = Type.Object({
  _id: Type.String(),
  name: Type.String(),
});

export const Session = Type.Intersect([
  User,
  Type.Object({ token: Type.String() }),
]);

export const LoginBody = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 254 }),
    password: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);

// The code the browser got back from Telegram's login, and its PKCE verifier
export const TelegramLoginBody = Type.Object(
  {
    code: Type.String({ minLength: 1, maxLength: 1024 }),
    codeVerifier: Type.String({ pattern: '^[A-Za-z0-9._~-]{43,128}$' }),
  },
  { additionalProperties: false },
);

// Telegram.WebApp.initData of a Mini App, checked by the server
export const TelegramWebAppBody = Type.Object(
  { initData: Type.String({ minLength: 1, maxLength: 8192 }) },
  { additionalProperties: false },
);

// Ways to sign in besides email; null when not configured
export const AuthProviders = Type.Object({
  telegram: Type.Union([
    Type.Object({ clientId: Type.String(), redirectUri: Type.String() }),
    Type.Null(),
  ]),
  // The server can check Mini App data (the bot is configured)
  miniApp: Type.Boolean(),
});

export const RegisterBody = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 254 }),
    name: Type.String({ minLength: 1, maxLength: 50 }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const UpdateMeBody = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 50 }) },
  { additionalProperties: false },
);

export const ChangePasswordBody = Type.Object(
  {
    currentPassword: Type.String({ minLength: 1, maxLength: 128 }),
    newPassword: Type.String({ minLength: 8, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const UserStats = Type.Object({ eventsCount: Type.Integer() });

// --- Events ---

export const Location = Type.Object(
  {
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lon: Type.Number({ minimum: -180, maximum: 180 }),
  },
  { additionalProperties: false },
);

const EventFields = {
  eventName: Type.String({ minLength: 1, maxLength: 100 }),
  place: Type.String({ minLength: 1, maxLength: 200 }),
  // Calendar day of the match as produced by <input type="date">
  date: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  // Start time at the venue, as produced by <input type="time">
  time: Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }),
  minimum: Type.Integer({ minimum: 0, maximum: 100 }),
  // Places on the pitch; later sure sign-ups wait in line. 0: no limit
  maximum: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  // Coordinates of the venue, used for the weather forecast
  location: Type.Optional(Location),
};

export const CreateEventBody = Type.Object(EventFields, {
  additionalProperties: false,
});

export const UpdateEventBody = Type.Partial(
  Type.Object(
    {
      ...EventFields,
      // null removes the venue coordinates
      location: Type.Union([Location, Type.Null()]),
    },
    { additionalProperties: false },
  ),
);

export const Event = Type.Object({
  _id: Type.String(),
  ...EventFields,
  playersAmount: Type.Integer(),
  creatorId: Type.String(),
  // The start as an instant; missing on events not yet migrated (scripts/migrate-dates.mjs)
  startsAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

// --- Players ---

export const Friend = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 50 }),
    status: Type.Boolean(),
  },
  { additionalProperties: false },
);

const PlayerFields = {
  name: Type.String({ minLength: 1, maxLength: 50 }),
  // true: definitely plays, false: maybe
  status: Type.Boolean(),
  friends: Type.Array(Friend, { maxItems: 20 }),
};

export const SignUpBody = Type.Object(PlayerFields, {
  additionalProperties: false,
});

export const UpdatePlayerBody = Type.Partial(
  Type.Object(PlayerFields, { additionalProperties: false }),
);

export const Player = Type.Object({
  _id: Type.String(),
  ...PlayerFields,
  eventId: Type.String(),
  userId: Type.String(),
  date: Type.String(),
  // Sure, but signed up after the places ran out
  waitlisted: Type.Boolean(),
});

export const PlayersCount = Type.Object({
  all: Type.Integer(),
  // Sure and with a place
  exactly: Type.Integer(),
  maybe: Type.Integer(),
  // Sure, waiting for a place
  waiting: Type.Integer(),
});

export const PlayersChange = Type.Object({
  player: Player,
  players: Type.Array(Player),
  event: Event,
  count: PlayersCount,
});

// --- Weather ---

export const DailyForecast = Type.Object({
  date: Type.String({ description: 'YYYY-MM-DD in the venue time zone' }),
  // WMO weather interpretation code
  weatherCode: Type.Integer(),
  description: Type.String(),
  tempMin: Type.Number(),
  tempMax: Type.Number(),
  precipitationProbability: Type.Union([Type.Integer(), Type.Null()]),
  windSpeedMax: Type.Number({ description: 'km/h' }),
});

export const EventWeather = Type.Object({
  location: Location,
  forecast: Type.Union([DailyForecast, Type.Null()], {
    description: 'null when the event is outside the 16-day forecast window',
  }),
});

export type ErrorResponse = Static<typeof ErrorResponse>;
export type UserRole = Static<typeof UserRole>;
export type User = Static<typeof User>;
export type TelegramLink = Static<typeof TelegramLink>;
export type PublicUser = Static<typeof PublicUser>;
export type Session = Static<typeof Session>;
export type LoginBody = Static<typeof LoginBody>;
export type RegisterBody = Static<typeof RegisterBody>;
export type TelegramLoginBody = Static<typeof TelegramLoginBody>;
export type TelegramWebAppBody = Static<typeof TelegramWebAppBody>;
export type AuthProviders = Static<typeof AuthProviders>;
export type UpdateMeBody = Static<typeof UpdateMeBody>;
export type ChangePasswordBody = Static<typeof ChangePasswordBody>;
export type UserStats = Static<typeof UserStats>;
export type Location = Static<typeof Location>;
export type CreateEventBody = Static<typeof CreateEventBody>;
export type UpdateEventBody = Static<typeof UpdateEventBody>;
export type Event = Static<typeof Event>;
export type Friend = Static<typeof Friend>;
export type SignUpBody = Static<typeof SignUpBody>;
export type UpdatePlayerBody = Static<typeof UpdatePlayerBody>;
export type Player = Static<typeof Player>;
export type PlayersCount = Static<typeof PlayersCount>;
export type PlayersChange = Static<typeof PlayersChange>;
export type DailyForecast = Static<typeof DailyForecast>;
export type EventWeather = Static<typeof EventWeather>;
