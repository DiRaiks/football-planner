import { observable, action, computed, transaction } from 'mobx';
import { fetch } from 'utils';
import { ErrorsStore, IExtractedFlatErrors } from 'store';
import { EMPTY_ERRORS } from 'store/errors';

import { IActionOptions } from './types';

class Action<T extends unknown, R extends unknown> {
  constructor(options?: IActionOptions) {
    this.showErrors = options?.showErrors ?? true;
    this.isInterrupted = options?.isInterrupted ?? false;
    this.translationPrefix = options?.translationPrefix;
  }

  @observable isPending = false;
  @observable errors: IExtractedFlatErrors = EMPTY_ERRORS;
  @observable status: number | null = null;

  showErrors: boolean;
  isInterrupted: boolean;
  abortController: AbortController | null = null;
  translationPrefix: string | undefined;

  @action setPending(state: boolean): void {
    this.isPending = state;
  }

  @action setStatus(status: number | null): void {
    this.status = status;
  }

  @action resetStatus(): void {
    this.status = null;
  }

  @action setErrors(errors: IExtractedFlatErrors): void {
    this.errors = errors;
  }

  @action resetErrors(): void {
    this.errors = EMPTY_ERRORS;
  }

  @action setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  @computed get firstError(): string | null {
    if (!this.errors.fields && !this.errors.global) return null;

    return ErrorsStore.getOneError(this.errors);
  }

  async callAction(
    actionUrl: string,
    method: RequestInit['method'] = 'post',
    payload?: T,
    queryParams?: Record<string, string>,
  ): Promise<void | boolean | R> {
    this.abortController?.abort();
    const currentAbortController = new AbortController();

    transaction(() => {
      if (this.isInterrupted) this.setAbortController(currentAbortController);
      this.setPending(true);
      this.resetErrors();
      this.resetStatus();
    });

    const body = payload ? JSON.stringify(payload) : null;

    try {
      const response = await fetch(actionUrl, { method, body, queryParams, signal: currentAbortController.signal });
      const { status, ok } = response;
      this.setStatus(status);

      if (status === 200) {
        try {
          const result: R = await response.json();

          return result;
        } catch {
          return true;
        }
      }

      if (ok) return true;

      const errors = this.showErrors
        ? await ErrorsStore.processGetErrors(response, this.translationPrefix)
        : await ErrorsStore.extractError(response, this.translationPrefix);

      this.setErrors(errors);
      this.setStatus(errors.status);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      const isSameCall = this.isInterrupted && this.abortController === currentAbortController;

      if (isSameCall || !this.isInterrupted) this.setPending(false);
    }
  }
}

export default Action;
