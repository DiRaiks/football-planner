import { useCallback } from 'react';
import { EventsStore } from 'store';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps } from 'hooks';

import { TEventForm, TEventFormSubmit } from './types';

export const useEventForm: TEventForm = () => {
  const isLoading = useObserver(() => EventsStore.createEventAction.isPending);

  const eventName = useTextField();
  const eventNameProps = useInputProps({
    ...eventName,
    localError: null,
    serverError: null,
    label: 'Название',
  });

  const place = useTextField();
  const placeProps = useInputProps({
    ...place,
    localError: null,
    serverError: null,
    label: 'Место',
  });

  const date = useTextField();
  const dateProps = useInputProps({
    ...date,
    localError: null,
    serverError: null,
    label: 'Дата',
  });

  const time = useTextField();
  const timeProps = useInputProps({
    ...time,
    localError: null,
    serverError: null,
    label: 'Время',
  });

  const minimum = useTextField();
  const minimumProps = useInputProps({
    ...minimum,
    localError: null,
    serverError: null,
    label: 'Количество игроков',
  });

  const isDisabled = !eventNameProps.value || !placeProps.value;

  const handleSubmit: TEventFormSubmit = useCallback(
    event => {
      event.preventDefault();

      const data = {
        eventName: eventNameProps.value,
        place: placeProps.value,
        date: dateProps.value,
        time: timeProps.value,
        minimum: minimumProps.value,
      };

      EventsStore.createEvent(data);
    },
    [dateProps.value, eventNameProps.value, minimumProps.value, placeProps.value, timeProps.value],
  );

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
