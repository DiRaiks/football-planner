import { useTextField } from './useTextField';

type TUsePassword = () => {
  password: string;
  changePassword: TChangePassword;
};

type TChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => void;

export const usePassword: TUsePassword = () => {
  const { value, changeValue } = useTextField();

  return { password: value, changePassword: changeValue };
};
