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
}

export interface IExtractedErrorsFields {
  [field: string]: string[];
}

export interface IExtractedFlatErrorsFields {
  [field: string]: string;
}

export interface IExtractedFlatErrors extends IExtractedErrors {
  fields: IExtractedFlatErrorsFields | null;
}

export interface IExtractMap {
  [code: number]: string;
}
