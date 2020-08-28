import { useCallback } from 'react';
import { EventsStore, EventStore } from 'store';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps } from 'hooks';

import { TUseEventForm, TEventFormSubmit } from './types';

export const useEventForm: TUseEventForm = props => {
  const { applyCallback } = props;
  const isCreatePending = useObserver(() => EventsStore.createEventAction.isPending);
  const isСhangePending = useObserver(() => EventStore.changeEventAction.isPending);
  const event = useObserver(() => EventStore.entity);

  const eventName = useTextField(event?.eventName ?? '');
  const eventNameProps = useInputProps({
    ...eventName,
    localError: null,
    serverError: null,
    label: 'Название',
  });

  const place = useTextField(event?.place ?? '');
  const placeProps = useInputProps({
    ...place,
    localError: null,
    serverError: null,
    label: 'Место',
  });

  const date = useTextField(event?.date ?? '');
  const dateProps = useInputProps({
    ...date,
    localError: null,
    serverError: null,
    label: 'Дата',
  });

  const time = useTextField(event?.time ?? '');
  const timeProps = useInputProps({
    ...time,
    localError: null,
    serverError: null,
    label: 'Время',
  });

  const minimum = useTextField(String(event?.minimum) ?? '');
  const minimumProps = useInputProps({
    ...minimum,
    localError: null,
    serverError: null,
    label: 'Количество игроков',
  });

  const isDisabled = !eventNameProps.value || !placeProps.value;

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

      const result = event ? await EventStore.changeEvent(data) : await EventsStore.createEvent(data);
      if (result) applyCallback && applyCallback();
    },
    [applyCallback, dateProps.value, eventNameProps.value, minimumProps.value, placeProps.value, timeProps.value],
  );

  const isLoading = isCreatePending || isСhangePending;

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
