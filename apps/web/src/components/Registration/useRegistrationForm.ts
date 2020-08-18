import { useCallback, useState, useEffect } from 'react';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps, useNewPassword, usePasswordEquals, usePasswordValidation } from 'hooks';
import { UserStore, IUserRegistrationModel } from 'store';

import { TUseRegistrationForm, THandleSubmit } from './types';

export const useRegistrationForm: TUseRegistrationForm = () => {
  const isPending = useObserver(() => UserStore.isRegistrationPending);
  const serverErrors = useObserver(() => UserStore.registrationErrors);
  const [isShowSuccessMessage, setIsShowSuccessMessage] = useState<boolean>(false);
  const [showLocalError, setShowLocalError] = useState(false);

  const { newPassword, repeatPassword, changeNewPassword, changeRepeatPassword } = useNewPassword();
  const { error: validationError } = usePasswordValidation(newPassword);
  const { error: equalsError } = usePasswordEquals(newPassword, repeatPassword);

  const usernameError = serverErrors.fields?.UserName || serverErrors.global;
  const emailError = serverErrors.fields?.UserName || serverErrors.global;
  const passwordError = serverErrors.fields?.Password || null;

  const userName = useTextField();
  const userNameProps = useInputProps({
    ...userName,
    localError: null,
    serverError: usernameError,
    label: 'Имя',
  });

  const email = useTextField();
  const emailProps = useInputProps({
    ...email,
    localError: null,
    serverError: emailError,
    label: 'Электронный адрес',
  });

  const passwordProps = useInputProps({
    value: newPassword,
    changeValue: changeNewPassword,
    localError: showLocalError ? validationError : null,
    serverError: passwordError,
    label: 'Пароль',
  });

  const repeatPasswordProps = useInputProps({
    value: repeatPassword,
    changeValue: changeRepeatPassword,
    localError: showLocalError ? equalsError : null,
    serverError: serverErrors.fields?.ConfirmPassword,
    label: 'Повторите пароль',
  });

  const hasLocalError = !!(validationError || equalsError);

  const registration = useCallback(async () => {
    const user: IUserRegistrationModel = {
      username: userNameProps.value,
      email: emailProps.value,
      password: '',
    };

    const result = await UserStore.registration(user);
    if (result) setIsShowSuccessMessage(true);
  }, [emailProps.value, userNameProps.value]);

  const handleSubmit: THandleSubmit = useCallback(
    event => {
      event.preventDefault();

      if (hasLocalError) {
        return setShowLocalError(true);
      }

      registration();
    },
    [hasLocalError, registration],
  );

  const isDisabled = !userNameProps.value || !emailProps.value || !passwordProps.value || !repeatPasswordProps.value;

  useEffect(() => {
    return (): void => {
      UserStore.resetRegistrationErrors();
      setIsShowSuccessMessage(false);
    };
  }, []);

  return {
    isDisabled,
    isPending,
    isShowSuccessMessage,
    handleSubmit,
    userNameProps,
    emailProps,
    passwordProps,
    repeatPasswordProps,
  };
};
