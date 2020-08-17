export type TFormSubmit = (event: React.FormEvent<HTMLFormElement>) => void;
export type TChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => void;

export type TInputProps = {
  onChange: TChangeInput;
  value: string;
  error: boolean;
  label: string;
};

export type TUseLoginForm = () => {
  isLoading: boolean;
  isDisabled: boolean;
  userNameProps: TInputProps;
  passwordProps: TInputProps;
  handleSubmit: TFormSubmit;
};
