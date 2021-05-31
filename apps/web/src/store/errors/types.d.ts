export enum CommonError {
  SERVER = 'serverError',
  CONNECTION = 'connectionError',
  UNKNOWN = 'unknownError',
}

export interface IErrorKeys {
  [code: number]: string;
}

export interface IExtractedErrors {
  global: string | null;
  fields: IExtractedErrorsFields | null;
  status: number | null;
}

export interface IExtractedErrorsFields {
  [field: string]: string[];
}

export interface IExtractedFlatErrorsFields {
  [field: string]: string;
}

export interface IExtractedFlatErrors extends Omit<IExtractedErrors, 'fields'> {
  fields: IExtractedFlatErrorsFields | null;
}

export interface IExtractMap {
  [code: number]: string;
}
