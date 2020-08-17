export type TUserToken = string | null;

export const getTokenFromLS = (): TUserToken => {
  return localStorage.getItem('token');
};

export const saveTokenToLS = (token: TUserToken): void => {
  if (!token) return;
  localStorage.setItem('token', token);
};

export const removeTokenToLS = (): void => {
  localStorage.removeItem('token');
};
