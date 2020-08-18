import { IUserStore } from './types';

export const LOGIN_URL = '/auth/login';
export const LOGOUT_URL = '/auth/logout';
export const USER_URL = '/auth/check';
export const REGISTRATION_URL = '/auth/registration';

export const DEFAULT_STATE: IUserStore = {
  user: null,
};
