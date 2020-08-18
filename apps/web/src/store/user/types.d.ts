export interface IUserStore {
  user: TUser;
}

export interface IUserLoginData {
  email: string;
  password: string;
}

export interface IUserRegistrationModel {
  username: string;
  email: string;
  password: string;
}

export type TUser = {
  _id: string;
  email: string;
  name: string;
  token: string;
} | null;
