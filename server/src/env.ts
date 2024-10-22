export type ENVS = {
  PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  BOT_TOKEN: string;
  LOG_FORMAT: string;
};

const ENV_SCHEME = {
  type: "object",
  required: [
    "PORT",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_NAME",
    "BOT_TOKEN",
    "LOG_FORMAT",
  ],
  properties: {
    PORT: {
      type: "number",
    },
    DATABASE_USER: {
      type: "string",
    },
    DATABASE_PASSWORD: {
      type: "string",
    },
    DATABASE_NAME: {
      type: "string",
    },
    BOT_TOKEN: {
      type: "string",
    },
    LOG_FORMAT: {
      type: "string",
      default: "info",
    },
  },
};

export const ENV_OPTIONS = {
  dotenv: true,
  schema: ENV_SCHEME,
};
