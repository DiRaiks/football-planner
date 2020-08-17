type TChangeValue = (event: React.ChangeEvent<HTMLInputElement>) => void;

type TUseInputResult<T> = {
  value: string;
  label: string;
  error: boolean;
  onChange: T;
  disabled?: boolean;
};

interface IUseInputPropsData<T> {
  localError?: string | null;
  serverError?: string | null;
  changeValue: T;
  value: string;
  label: string;
  disabled?: boolean;
}

export const useInputProps = <T = TChangeValue>({
  localError,
  serverError,
  changeValue,
  value,
  label,
  disabled,
}: IUseInputPropsData<T>): TUseInputResult<T> => {
  const errorMessage = localError || serverError;

  return {
    value,
    onChange: changeValue,
    error: !!errorMessage,
    label: errorMessage || label,
    disabled,
  };
};
