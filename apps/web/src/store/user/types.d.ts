export interface IUserStore {
  user: TUser;
}

export interface IUserLoginData {
  email: string;
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

export type TUser = {
  _id: string;
  email: string;
  name: string;
  token: string;
} | null;
