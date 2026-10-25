import React, { FC } from 'react';

import { ServiceForm, Button, Input, IconButton } from 'reusableComponents';

import { useEventForm } from './useEventForm';
import { IEventFormProps } from './types';
import styles from './eventForm.module.scss';

export const EventForm: FC<IEventFormProps> = props => {
  const { eventId, onCancel } = props;
  const {
    isLoading,
    isDisabled,
    handleSubmit,
    eventNameProps,
    placeProps,
    dateProps,
    timeProps,
    minimumProps,
  } = useEventForm(props);

  const buttonTitle = eventId ? 'Применить' : 'Создать матч';

  return (
    <ServiceForm method="post" onSubmit={handleSubmit} className={styles.form}>
      {eventId && (
        <IconButton
          data-tooltip="Отмена"
          className={styles.closeIcon}
          variant="ghost"
          icon="close"
          onClick={onCancel}
        />
      )}
      <Input className={styles.input} autoFocus autoComplete="eventName" {...eventNameProps} />
      <Input className={styles.input} autoComplete="place" {...placeProps} />
      <div className={styles.dateTime}>
        <Input className={styles.date} autoComplete="date" {...dateProps} type="date" />
        <Input className={styles.time} autoComplete="time" {...timeProps} type="time" />
      </div>
      <Input className={styles.input} autoComplete="minimum" {...minimumProps} type="number" min="0" max="20" />
      <Button
        type="submit"
        disabled={isDisabled}
        loading={isLoading}
        size={eventId ? 'm' : 'l'}
        className={styles.createButton}
      >
        {buttonTitle}
      </Button>
    </ServiceForm>
  );
};

export default EventForm;
