import { observable, action, computed } from 'mobx';
import { fetch } from 'utils';
import { ErrorsStore, IExtractedFlatErrors } from 'store';
import { EMPTY_ERRORS } from 'store/errors';

class EntityStore<T> {
  @observable entity: T | null = null;
  @observable isPending = false;
  @observable updateEntityErrors: IExtractedFlatErrors = EMPTY_ERRORS;

  abortController: AbortController | null = null;

  @action setPending(state: boolean): void {
    this.isPending = state;
  }

  @action setEntity(entity: T | null): void {
    this.entity = entity;
  }

  @action setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  @action setUpdateEntityErrors(errors: IExtractedFlatErrors): void {
    this.updateEntityErrors = errors;
  }

  @action resetUpdateEntityErrors(): void {
    this.updateEntityErrors = EMPTY_ERRORS;
  }

  @computed get isEntityFetchError(): boolean {
    return !!(this.updateEntityErrors.fields || this.updateEntityErrors.global);
  }

  resetEntity(): void {
    this.setEntity(null);
    this.abortController?.abort();
  }

  async updateEntity(entityUrl: string): Promise<void | boolean> {
    this.abortController?.abort();
    const currentAbortController = new AbortController();

    this.resetUpdateEntityErrors();
    this.setAbortController(currentAbortController);
    this.setPending(true);

    try {
      const response = await fetch(entityUrl, {
        method: 'get',
        signal: currentAbortController.signal,
      });

      const { status, ok } = response;

      if (ok && status === 200) {
        const data = await response.json();
        this.setEntity(data);

        return true;
      }

      const errors = await ErrorsStore.extractError(response);
      this.setUpdateEntityErrors(errors);
    } catch (error) {
      ErrorsStore.showTempError(error);
    } finally {
      if (this.abortController === currentAbortController) {
        this.setPending(false);
      }
    }
  }
}

export default EntityStore;
