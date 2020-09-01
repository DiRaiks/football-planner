import { observable, action, computed } from 'mobx';
import { fetch, getTokenFromLS, saveTokenToLS, removeTokenToLS } from 'utils';
import { ErrorsStore, IExtractedFlatErrors, Action } from 'store';
import { EMPTY_ERRORS } from 'store/errors';

import { IUserLoginData, TUser, IUserRegistrationModel } from './types.d';
import { DEFAULT_STATE, LOGIN_URL, LOGOUT_URL, USER_URL, REGISTRATION_URL } from './constants';

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
  @observable isCheckTokenPending = false;
  @observable isRegistrationPending = false;
  @observable userEventsCount: number | null = 0;

  @computed get isAuthenticated(): boolean {
    return !!this.user;
  }

  @computed get isInitialUserPending(): boolean {
    return this.updateUserAction.isPending && !this.isAuthenticated;
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

  @action setUserEventsCount(eventCount: number | null): void {
    this.userEventsCount = eventCount;
  }

  updateUserAction = new Action<{}, TUser>();
  getUserEventsCountAction = new Action<{}, number>();

  async updateUser(): Promise<void | boolean> {
    if (!getTokenFromLS()) return;

    const result = await this.updateUserAction.callAction(USER_URL, 'get');

    if (result && typeof result === 'object') {
      this.setUser(result);
      this.getUserEventsCount(result._id);
    }
  }

  async getUserEventsCount(userId: string): Promise<void> {
    const result = await this.getUserEventsCountAction.callAction(`/users/userEventsCount/${userId}`, 'get');

    if (typeof result === 'number') this.setUserEventsCount(result);
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
        const user: TUser = await response.json();
        this.setUser(user);

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
