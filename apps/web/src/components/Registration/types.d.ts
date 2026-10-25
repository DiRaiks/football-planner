export type THandleSubmit = (event: React.FormEvent<HTMLFormElement>) => void;
export type TChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => void;

export type TInputProps = {
  onChange: TChangeInput;
  value: string;
  error: boolean;
  label: string;
};

export type TUseRegistrationForm = () => {
  isPending: boolean;
  isDisabled: boolean;
  isShowSuccessMessage: boolean;
  handleSubmit: THandleSubmit;
  userNameProps: TInputProps;
  emailProps: TInputProps;
  passwordProps: TInputProps;
  repeatPasswordProps: TInputProps;
};
