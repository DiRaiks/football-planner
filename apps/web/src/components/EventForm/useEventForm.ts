import { useCallback, useEffect } from 'react';
import { UserStore } from 'store';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps } from 'hooks';

import { TEventForm, TEventFormSubmit } from './types';

export const useEventForm: TEventForm = () => {
  const isLoading = useObserver(() => UserStore.isLoginPending);
  const errors = useObserver(() => UserStore.loginErrors);

  const eventNameError = errors.fields?.UserName || errors.global;
  const placeError = errors.fields?.Place || null;
  const dateError = errors.fields?.Date || null;
  const timeError = errors.fields?.Time || null;
  const minimumError = errors.fields?.Minimum || null;

  const eventName = useTextField();
  const eventNameProps = useInputProps({
    ...eventName,
    localError: null,
    serverError: eventNameError,
    label: 'Название',
  });

  const place = useTextField();
  const placeProps = useInputProps({
    ...place,
    localError: null,
    serverError: placeError,
    label: 'Место',
  });

  const date = useTextField();
  const dateProps = useInputProps({
    ...date,
    localError: null,
    serverError: dateError,
    label: 'Дата',
  });

  const time = useTextField();
  const timeProps = useInputProps({
    ...time,
    localError: null,
    serverError: timeError,
    label: 'Время',
  });

  const minimum = useTextField();
  const minimumProps = useInputProps({
    ...minimum,
    localError: null,
    serverError: minimumError,
    label: 'Количество игроков',
  });

  const isDisabled = !eventNameProps.value || !placeProps.value;

  const handleSubmit: TEventFormSubmit = useCallback(event => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    return (): void => UserStore.resetLoginErrors();
  }, []);

  return {
    isLoading,
    isDisabled,
    eventNameProps,
    placeProps,
    dateProps,
    timeProps,
    minimumProps,
    handleSubmit,
  };
};
