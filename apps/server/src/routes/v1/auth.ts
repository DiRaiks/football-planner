import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  AuthProviders,
  LoginBody,
  RegisterBody,
  Session,
  TelegramLoginBody,
  TelegramWebAppBody,
  User,
} from '@football-planner/shared';

import { AppError } from '../../lib/errors.js';
import { verifyInitData } from '../../modules/users/telegram-login.js';
import {
  toPublicUser,
  type UserDocument,
} from '../../modules/users/user.model.js';

const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const { users, telegramAccounts, telegramLogin } = fastify.services;
  const { BOT_TOKEN } = fastify.config;
  const session = (user: UserDocument, expiresIn?: string) => ({
    ...toPublicUser(user),
    token: fastify.issueToken(user, expiresIn),
  });
  const disabled = () =>
    new AppError(404, 'TELEGRAM_DISABLED', 'telegram login is not configured');
  const rateLimit = {
    max: fastify.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  };

  fastify.post(
    '/login',
    {
      schema: { body: LoginBody, response: { 200: Session } },
      config: { rateLimit },
    },
    async (request) => {
      return session(await users.login(request.body));
    },
  );

  fastify.post(
    '/register',
    {
      schema: { body: RegisterBody, response: { 200: Session } },
      config: { rateLimit },
    },
    async (request) => {
      return session(await users.register(request.body));
    },
  );

  fastify.get(
    '/providers',
    { schema: { response: { 200: AuthProviders } } },
    async () => ({
      telegram: telegramLogin && {
        clientId: telegramLogin.clientId,
        redirectUri: telegramLogin.redirectUri,
      },
      miniApp: Boolean(BOT_TOKEN),
    }),
  );

  // "Log in with Telegram" on the site: the account of that Telegram user, made on
  // the first login like one made from the bot's buttons
  fastify.post(
    '/telegram',
    {
      schema: { body: TelegramLoginBody, response: { 200: Session } },
      config: { rateLimit },
    },
    async (request) => {
      if (!telegramLogin) throw disabled();
      const { code, codeVerifier } = request.body;
      const from = await telegramLogin.exchange(code, codeVerifier);
      return session(await telegramAccounts.findOrCreate(from));
    },
  );

  // The site opened as a Mini App: Telegram vouches for the user in initData
  fastify.post(
    '/telegram/webapp',
    {
      schema: { body: TelegramWebAppBody, response: { 200: Session } },
      config: { rateLimit },
    },
    async (request) => {
      if (!BOT_TOKEN) throw disabled();
      const { user } = verifyInitData(request.body.initData, BOT_TOKEN);
      // The Mini App signs in again on every launch: a short session is enough
      return session(await telegramAccounts.findOrCreate(user), '1d');
    },
  );

  fastify.get(
    '/me',
    { onRequest: [fastify.authenticate], schema: { response: { 200: User } } },
    async (request) => toPublicUser(request.currentUser!),
  );
};

export default authRoutes;
