import { useCallback } from 'react';
import { EventsStore, EventStore } from 'store';
import { useObserver } from 'mobx-react';

import { useTextField, useInputProps } from 'hooks';

import { TUseEventForm, TEventFormSubmit } from './types';

export const useEventForm: TUseEventForm = () => {
  const isLoading = useObserver(() => EventsStore.createEventAction.isPending);
  const event = useObserver(() => EventStore.entity);

  const { value: eventNameValue, changeValue: changeEventNameValue } = useTextField('');
  const eventNameProps = useInputProps({
    value: event ? event.eventName ?? '' : eventNameValue,
    changeValue: changeEventNameValue,
    localError: null,
    serverError: null,
    label: 'Название',
  });

  const { value: placeValue, changeValue: changePlaceValue } = useTextField();
  const placeProps = useInputProps({
    value: event ? event.place ?? '' : placeValue,
    changeValue: changePlaceValue,
    localError: null,
    serverError: null,
    label: 'Место',
  });

  const { value: dateValue, changeValue: changeDateValue } = useTextField();
  const dateProps = useInputProps({
    value: event ? event.date ?? '' : dateValue,
    changeValue: changeDateValue,
    localError: null,
    serverError: null,
    label: 'Дата',
  });

  const { value: timeValue, changeValue: changeTimeValue } = useTextField();
  const timeProps = useInputProps({
    value: event ? event.time ?? '' : timeValue,
    changeValue: changeTimeValue,
    localError: null,
    serverError: null,
    label: 'Время',
  });

  const { value: minimumValue, changeValue: changeMinimumValue } = useTextField('0');
  const minimumProps = useInputProps({
    value: event ? String(event.minimum) ?? '' : minimumValue,
    changeValue: changeMinimumValue,
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
