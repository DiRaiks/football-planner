import { observable, action, computed } from 'mobx';
import { fetch, getTokenFromLS, saveTokenToLS, removeTokenToLS } from 'utils';
import { ErrorsStore, IExtractedFlatErrors } from 'store';
import { EMPTY_ERRORS } from 'store/errors';

import { IUserLoginData, TUser, IUserRegistrationModel } from './types.d';
import { DEFAULT_STATE, LOGIN_URL, LOGOUT_URL, USER_URL, REGISTRATION_URL, CHECK_TOKEN_URL } from './constants';

class UserStore {
  constructor() {
    this.updateUser();
    this.initLSListener();
  }

  @observable user = DEFAULT_STATE.user;
  @observable loginErrors = EMPTY_ERRORS;
  @observable registrationErrors = EMPTY_ERRORS;
  @observable checkTokenErrors = EMPTY_ERRORS;
  @observable changePasswordErrors = EMPTY_ERRORS;
  @observable isLoginPending = false;
  @observable isUserPending = false;
  @observable isCheckTokenPending = false;
  @observable isRegistrationPending = false;

  @computed get isAuthenticated(): boolean {
    return !!this.user;
  }

  @computed get isInitialUserPending(): boolean {
    return this.isUserPending && !this.isAuthenticated;
  }

  @computed get username(): string {
    return this.user?.name || '';
  }

  // pending

  @action setLoginPending(state: boolean): void {
    this.isLoginPending = state;
  }

  @action setCheckTokenPending(state: boolean): void {
    this.isCheckTokenPending = state;
  }

  @action setUserPending(state: boolean): void {
    this.isUserPending = state;
  }

  @action setRegistrationPending(state: boolean): void {
    this.isRegistrationPending = state;
  }

  // errors

  @action setLoginErrors(errors: IExtractedFlatErrors): void {
    this.loginErrors = errors;
  }

  @action resetLoginErrors(): void {
    this.loginErrors = EMPTY_ERRORS;
  }

  @action setSignUpErrors(errors: IExtractedFlatErrors): void {
    this.registrationErrors = errors;
  }

  @action resetRegistrationErrors(): void {
    this.registrationErrors = EMPTY_ERRORS;
  }

  @action setCheckTokenErrors(errors: IExtractedFlatErrors): void {
    this.checkTokenErrors = errors;
  }

  @action resetCheckTokenErrors(): void {
    this.checkTokenErrors = EMPTY_ERRORS;
  }

  @action setChangePasswordErrors(errors: IExtractedFlatErrors): void {
    this.changePasswordErrors = errors;
  }

  @action resetChangePasswordErrors(): void {
    this.changePasswordErrors = EMPTY_ERRORS;
  }

  // user

  @action setUser(user: TUser): void {
    saveTokenToLS(user?.token || null);
    this.user = user;
  }

  @action resetUser(): void {
    Object.assign(this, DEFAULT_STATE);
    removeTokenToLS();
  }

  async updateUser(): Promise<void | boolean> {
    if (!getTokenFromLS()) return;

    this.setUserPending(true);

    try {
      const response = await fetch(USER_URL);

      if (response.ok) {
        const user: TUser = await response.json();
        this.setUser(user);

        return true;
      }

      ErrorsStore.processGetErrors(response);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      this.setUserPending(false);
    }
  }

  async login({ email, password }: IUserLoginData): Promise<void> {
    this.setLoginPending(true);
    this.setUser(null);
    this.resetLoginErrors();

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'post',
        body: JSON.stringify({ email, password }),
      });

      const { status, ok } = response;

      if (ok && status === 201) {
        const user: TUser = await response.json();
        this.setUser(user);

        return;
      }

      const errors = await ErrorsStore.extractError(response, 'auth.errors', {
        401: 'UserName',
        403: 'UserName',
        404: 'UserName',
      });

      this.setLoginErrors(errors);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      this.setLoginPending(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(LOGOUT_URL, {
        method: 'post',
        body: JSON.stringify({}),
      });
    } catch (error) {
    } finally {
      this.resetUser();
    }
  }

  async registration(data: IUserRegistrationModel): Promise<void | boolean> {
    this.setRegistrationPending(true);
    this.setUser(null);
    this.resetRegistrationErrors();

    try {
      const response = await fetch(REGISTRATION_URL, {
        method: 'post',
        body: JSON.stringify(data),
      });

      const { status, ok } = response;

      if (ok && status === 200) {
        return true;
      }

      const errors = await ErrorsStore.extractError(response, 'auth.errors', {
        409: 'Email',
      });

      this.setSignUpErrors(errors);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      this.setRegistrationPending(false);
    }
  }

  async checkToken(email: string, token: string): Promise<void | boolean> {
    this.setCheckTokenPending(true);
    this.resetCheckTokenErrors();

    try {
      const response = await fetch(CHECK_TOKEN_URL, {
        method: 'get',
        queryParams: { email, token },
      });

      if (response.ok) {
        const result: string = await response.json();

        if (result === 'Success') return true;

        return this.setCheckTokenErrors(
          ErrorsStore.translateErrors(
            {
              global: result,
              fields: null,
            },
            'auth.errors.token',
          ),
        );
      }

      const errors = await ErrorsStore.extractError(response, 'auth.errors.token');
      this.setCheckTokenErrors(errors);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      this.setCheckTokenPending(false);
    }
  }

  initLSListener(): void {
    window.addEventListener('storage', this.localStorageHandler.bind(this));
  }

  localStorageHandler(): void {
    this.checkLSToken();
  }

  checkLSToken(): void {
    const token = getTokenFromLS();

    if (!token) this.logout();
    if (token && !this.isAuthenticated) this.updateUser();
  }
}

export default new UserStore();
