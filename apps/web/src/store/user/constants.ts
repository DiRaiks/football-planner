import { IUserStore } from './types';

export const LOGIN_URL = '/auth/login';
export const LOGOUT_URL = '/auth/logout';
export const USER_URL = '/auth/check';
export const SESSION_URL = '/usersession/current';
export const REGISTRATION_URL = '/auth/signup/user';
export const CHECK_TOKEN_URL = '/password/resetToken/isValid';

export const DEFAULT_STATE: IUserStore = {
  user: null,
};
