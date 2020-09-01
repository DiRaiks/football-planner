import { useCallback } from 'react';
import { EventsStore, EventStore } from 'store';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps } from 'hooks';

import { TUseEventForm, TEventFormSubmit } from './types';

export const useEventForm: TUseEventForm = props => {
  const { applyCallback } = props;
  const isCreatePending = useObserver(() => EventsStore.createEventAction.isPending);
  const isChangePending = useObserver(() => EventStore.changeEventAction.isPending);
  const currentEvent = useObserver(() => EventStore.entity);

  const eventName = useTextField(currentEvent?.eventName ?? '');
  const eventNameProps = useInputProps({
    ...eventName,
    localError: null,
    serverError: null,
    label: 'Название',
  });

  const place = useTextField(currentEvent?.place ?? '');
  const placeProps = useInputProps({
    ...place,
    localError: null,
    serverError: null,
    label: 'Место',
  });

  const date = useTextField(currentEvent?.date ?? '');
  const dateProps = useInputProps({
    ...date,
    localError: null,
    serverError: null,
    label: 'Дата',
  });

  const time = useTextField(currentEvent?.time ?? '');
  const timeProps = useInputProps({
    ...time,
    localError: null,
    serverError: null,
    label: 'Время',
  });

  const minimum = useTextField(currentEvent?.minimum ? String(currentEvent?.minimum) : '');
  const minimumProps = useInputProps({
    ...minimum,
    localError: null,
    serverError: null,
    label: 'Количество игроков',
  });

  const isDisabled =
    !eventNameProps.value || !placeProps.value || !minimumProps.value || !timeProps.value || !dateProps.value;

  const handleSubmit: TEventFormSubmit = useCallback(
    async event => {
      event.preventDefault();

      const data = {
        eventName: eventNameProps.value,
        place: placeProps.value,
        date: dateProps.value,
        time: timeProps.value,
        minimum: minimumProps.value,
      };

      const result = currentEvent ? await EventStore.changeEvent(data) : await EventsStore.createEvent(data);
      if (result) applyCallback && applyCallback();
    },
    [
      applyCallback,
      currentEvent,
      dateProps.value,
      eventNameProps.value,
      minimumProps.value,
      placeProps.value,
      timeProps.value,
    ],
  );

  const isLoading = isCreatePending || isChangePending;

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
