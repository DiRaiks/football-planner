import { observable, action } from 'mobx';
import { fetch } from 'utils';
import { ErrorsStore } from 'store';

import { IActionOptions } from './types';

class Action<T extends unknown, R extends unknown> {
  constructor(options?: IActionOptions) {
    this.isInterrupted = options?.isInterrupted ?? false;
    this.translationPrefix = options?.translationPrefix;
  }

  @observable isPending = false;

  isInterrupted: boolean;
  abortController: AbortController | null = null;
  translationPrefix: string | undefined;

  @action setPending(state: boolean): void {
    this.isPending = state;
  }

  @action setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  async callAction(
    actionUrl: string,
    method: RequestInit['method'] = 'post',
    payload?: T,
    queryParams?: Record<string, string>,
  ): Promise<void | boolean | R> {
    this.abortController?.abort();
    const currentAbortController = new AbortController();
    if (this.isInterrupted) this.setAbortController(currentAbortController);

    this.setPending(true);

    const body = payload ? JSON.stringify(payload) : null;

    try {
      const response = await fetch(actionUrl, { method, body, queryParams, signal: currentAbortController.signal });
      const { status, ok } = response;

      if (status === 200) {
        try {
          const result: R = await response.json();

          return result;
        } catch {
          return true;
        }
      }

      if (ok) return true;

      ErrorsStore.processGetErrors(response, this.translationPrefix);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      const isSameCall = this.isInterrupted && this.abortController === currentAbortController;

      if (isSameCall || !this.isInterrupted) this.setPending(false);
    }
  }
}

export default Action;
