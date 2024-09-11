import Fastify from "fastify";
import fastifyEnv from "@fastify/env";

const fastify = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      allowUnionTypes: true,
    },
  },
});

const ENV_SCHEME = {
  type: "object",
  required: [
    "PORT",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_NAME",
    "BOT_TOKEN",
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
  },
};
const ENV_OPTIONS = {
  dotenv: true,
  schema: ENV_SCHEME,
};

void fastify.register(fastifyEnv, ENV_OPTIONS);
