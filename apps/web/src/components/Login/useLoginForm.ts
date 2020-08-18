import { useCallback, useEffect } from 'react';
import { UserStore } from 'store';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps } from 'hooks';

import { TUseLoginForm, TFormSubmit } from './types';

export const useLoginForm: TUseLoginForm = () => {
  const isLoading = useObserver(() => UserStore.isLoginPending);
  const errors = useObserver(() => UserStore.loginErrors);

  const usernameError = errors.fields?.UserName || errors.global;
  const passwordError = errors.fields?.Password || null;

  const userName = useTextField();
  const userNameProps = useInputProps({
    ...userName,
    localError: null,
    serverError: usernameError,
    label: 'Электронная почта',
  });

  const password = useTextField();
  const passwordProps = useInputProps({
    ...password,
    localError: null,
    serverError: passwordError,
    label: 'Пароль',
  });

  const isDisabled = !userNameProps.value || !passwordProps.value;

  const handleSubmit: TFormSubmit = useCallback(
    event => {
      event.preventDefault();

      UserStore.login({
        email: userNameProps.value,
        password: passwordProps.value,
      });
    },
    [userNameProps.value, passwordProps.value],
  );

  useEffect(() => {
    return (): void => UserStore.resetLoginErrors();
  }, []);

  return {
    isLoading,
    isDisabled,
    userNameProps,
    passwordProps,
    handleSubmit,
  };
};
