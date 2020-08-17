export interface IUserStore {
  user: TUser;
}

export interface IUserLoginData {
  username: string;
  password: string;
}

export interface ISignupPersonModel {
  fullName: string;
  email: string;
  phone?: string;
  currencyId: string;
}

export interface ISignupCompanyModel {
  countryId?: string;
  currencyId?: string;
  companyName?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  phone?: string;
  user?: ISignupPersonModel;
}

export type TUserSession = {
  language: string;
  timeZoneOffset: number;
  audioPlaybackVolume: number;
  audioPlaybackSpeed: number;
  shortDatePattern: string;
  firstDayOfWeek: string;
  tenantId: string;
  token: string;
};

export type TUser = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  userName: string;
  currencyId: string;
  token?: string;
  session: TUserSession;
  accountId: string;
} | null;
