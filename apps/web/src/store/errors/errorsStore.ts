import mapValues from 'lodash/mapValues';
import get from 'lodash/get';
import set from 'lodash/set';
import size from 'lodash/size';
import last from 'lodash/last';

import { AlertsStore, UserStore } from 'store';
import { getTokenFromLS } from 'utils';

import errors from './errors.json';
import { ERROR_KEYS, EMPTY_ERRORS, GLOBAL_ERRORS_TRANSLATION_PREFIX } from './constants';
import { CommonError, IExtractedErrors, IExtractedFlatErrors, IExtractMap } from './types.d';

class ErrorsStore {
  getErrorMessage(error: unknown): string | null {
    const translate = this.getErrorTranslation.bind(this, GLOBAL_ERRORS_TRANSLATION_PREFIX);

    if (error instanceof Error) {
      // skip fetch abort
      if (error?.name === 'AbortError') return null;

      if (error.message === 'Failed to fetch') {
        return translate(CommonError.CONNECTION);
      }

      return translate(error.message);
    }

    if (typeof error === 'string') {
      return translate(error);
    }

    return translate(CommonError.UNKNOWN);
  }

  showTempError(error: unknown): void {
    const errorMessage = this.getErrorMessage(error);
    if (errorMessage) AlertsStore.showTempAlert(errorMessage, 'error');
  }

  showError(error: unknown): void {
    const errorMessage = this.getErrorMessage(error);
    if (errorMessage) AlertsStore.showError(errorMessage);
  }

  getErrorTranslation(translationPrefix: string | undefined, errorKey: string | null): string | null {
    if (!errorKey) return null;

    const translationKey = [translationPrefix, errorKey].join('.');
    const globalKey = [GLOBAL_ERRORS_TRANSLATION_PREFIX, errorKey].join('.');
    const translation = get(errors, translationKey) || get(errors, globalKey) || errorKey;

    return String(translation);
  }

  translateErrors(errors: IExtractedErrors, translationPrefix?: string): IExtractedFlatErrors {
    const { global, fields } = errors;
    const translate = this.getErrorTranslation.bind(this, translationPrefix);

    return {
      global: translate(global),
      fields: fields
        ? mapValues(fields, fieldErrors => {
            if (Array.isArray(fieldErrors)) {
              return translate(last(fieldErrors) || null) || '';
            }

            return translate(fieldErrors) || '';
          })
        : null,
    };
  }

  async extractError(
    response: Response,
    translationPrefix?: string,
    extractMap?: IExtractMap,
  ): Promise<IExtractedFlatErrors> {
    const { ok, status } = response;

    const extractedErrors: IExtractedErrors = {
      global: null,
      fields: null,
    };

    if (ok) {
      throw new Error('The answer does not need error handling');
    }

    if (status === 401 && getTokenFromLS()) {
      UserStore.logout();

      return EMPTY_ERRORS;
    }

    // client errors
    if (status >= 400 && status < 500) {
      try {
        const mappedErrors = await this.mapErrors(response, extractMap);
        Object.assign(extractedErrors, mappedErrors);
      } catch (error) {
        console.error(error);
      }
    }

    // server errors
    if (status >= 500 && status < 600) {
      extractedErrors.global = ERROR_KEYS[status] || CommonError.SERVER;
    }

    // extract data from code
    if (!size(extractedErrors.fields) && !extractedErrors.global) {
      extractedErrors.global = ERROR_KEYS[status] || CommonError.UNKNOWN;
    }

    return this.translateErrors(extractedErrors, translationPrefix);
  }

  async mapErrors(response: Response, extractMap?: IExtractMap): Promise<IExtractedErrors> {
    const { status } = response;
    const { errors, Error = null } = await response.json();
    const mappedField = extractMap?.[status];

    const extractedErrors: IExtractedErrors = {
      global: !mappedField ? Error : null,
      fields: size(errors) ? errors : null,
    };

    if (!mappedField) return extractedErrors;

    return set(extractedErrors, `fields.${mappedField}`, [Error || ERROR_KEYS[status]]);
  }

  getOneError(errors: IExtractedFlatErrors): string | null {
    if (errors.global) return errors.global;
    if (errors.fields) return Object.values(errors.fields)[0];

    return null;
  }

  async processGetErrors(response: Response, translationPrefix?: string): Promise<void> {
    const errors = await this.extractError(response, translationPrefix);
    const error = this.getOneError(errors);

    this.showTempError(error || CommonError.UNKNOWN);
  }
}

export default new ErrorsStore();
