import { usePassword } from './usePassword';

type TUseNewPassword = () => {
  newPassword: string;
  repeatPassword: string;
  changeNewPassword: TChangePassword;
  changeRepeatPassword: TChangePassword;
};

type TChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => void;

export const useNewPassword: TUseNewPassword = () => {
  const { password: newPassword, changePassword: changeNewPassword } = usePassword();
  const { password: repeatPassword, changePassword: changeRepeatPassword } = usePassword();

  return {
    newPassword,
    repeatPassword,
    changeNewPassword,
    changeRepeatPassword,
  };
};
