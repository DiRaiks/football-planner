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
  // Telegram profile photo, once the user logged in with Telegram
  photoUrl: Type.Optional(Type.String()),
  // Where players send money for matches this user organises
  paymentDetails: Type.Optional(Type.String()),
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
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
    // An empty string removes them
    paymentDetails: Type.Optional(Type.String({ maxLength: 200 })),
  },
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
    // The city the coordinates were picked by, shown in the match form
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  },
  { additionalProperties: false },
);

/** A city found by name, for the match form */
export const City = Type.Object({
  name: Type.String(),
  // Region and country, to tell cities of the same name apart
  region: Type.String(),
  lat: Type.Number(),
  lon: Type.Number(),
});

/** The location of matches without one of their own; null when weather is off */
export const DefaultLocation = Type.Object({
  location: Type.Union([Location, Type.Null()]),
});

/** A place matches were played at, with the city of the latest of them */
export const SavedPlace = Type.Object({
  place: Type.String(),
  location: Type.Union([Location, Type.Null()]),
});

export const CitySearchQuery = Type.Object(
  { q: Type.String({ minLength: 2, maxLength: 100 }) },
  { additionalProperties: false },
);

export const DeadlineHours = Type.Union([
  Type.Literal(0),
  Type.Literal(6),
  Type.Literal(12),
  Type.Literal(24),
]);

export const PriceMode = Type.Union([
  Type.Literal('person'),
  Type.Literal('pitch'),
]);

/** Where to send the money for a match: its organiser's details, if any */
export const EventPayment = Type.Object({
  details: Type.Union([Type.String(), Type.Null()]),
});

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
  // weekly: when the match starts, the next one a week later is created
  repeat: Type.Optional(
    Type.Union([Type.Literal('none'), Type.Literal('weekly')]),
  ),
  // Whole roubles, 0: free. Per person, or for the whole pitch (priceMode)
  price: Type.Optional(Type.Integer({ minimum: 0, maximum: 100_000 })),
  // pitch: the price is shared equally by everyone in the squad
  priceMode: Type.Optional(PriceMode),
  // Coordinates of the venue, used for the weather forecast
  location: Type.Optional(Location),
  // Hours before the start when the bot checks the minimum is reached. 0: no check
  deadlineHours: Type.Optional(DeadlineHours),
  // Cancel the match when the minimum is not reached by then, instead of a warning
  autoCancel: Type.Optional(Type.Boolean()),
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
  // Teams split by the organiser: names per team
  teams: Type.Optional(Type.Array(Type.Array(Type.String()))),
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
  // Paid for the pitch, for themselves and the sure friends they bring
  paid: Type.Boolean(),
  // The player's Telegram profile photo, if known
  photoUrl: Type.Optional(Type.String()),
});

export const SetPaidBody = Type.Object(
  { paid: Type.Boolean() },
  { additionalProperties: false },
);

export const SplitTeamsBody = Type.Object(
  { count: Type.Optional(Type.Integer({ minimum: 2, maximum: 4 })) },
  { additionalProperties: false },
);

export const AttendanceQuery = Type.Object(
  // Matches of the last `days`, a week to a year; 0 is all time
  {
    days: Type.Optional(
      Type.Union([Type.Literal(0), Type.Integer({ minimum: 7, maximum: 365 })]),
    ),
  },
  { additionalProperties: false },
);

export const AttendanceRow = Type.Object({
  userId: Type.String(),
  name: Type.String(),
  // Matches played: sure and with a place
  played: Type.Integer(),
  maybe: Type.Integer(),
  lastPlayed: Type.Union([Type.String(), Type.Null()]),
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

/** The weather at the hour a match starts */
export const Forecast = Type.Object({
  time: Type.String({ description: 'start of the hour, ISO in UTC' }),
  // WMO weather interpretation code
  weatherCode: Type.Integer(),
  description: Type.String(),
  temperature: Type.Number(),
  precipitationProbability: Type.Union([Type.Integer(), Type.Null()]),
  windSpeed: Type.Number({ description: 'km/h' }),
});

export const EventWeather = Type.Object({
  location: Location,
  forecast: Type.Union([Forecast, Type.Null()], {
    description: 'null when the start is outside the 16-day forecast window',
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
export type SetPaidBody = Static<typeof SetPaidBody>;
export type SplitTeamsBody = Static<typeof SplitTeamsBody>;
export type AttendanceQuery = Static<typeof AttendanceQuery>;
export type AttendanceRow = Static<typeof AttendanceRow>;
export type Forecast = Static<typeof Forecast>;
export type City = Static<typeof City>;
export type DeadlineHours = Static<typeof DeadlineHours>;
export type PriceMode = Static<typeof PriceMode>;
export type EventPayment = Static<typeof EventPayment>;
export type SavedPlace = Static<typeof SavedPlace>;
export type CitySearchQuery = Static<typeof CitySearchQuery>;
export type DefaultLocation = Static<typeof DefaultLocation>;
export type EventWeather = Static<typeof EventWeather>;
