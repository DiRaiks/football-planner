import React, { FC } from 'react';

import { ServiceForm, Button, Input } from 'reusableComponents';

import { useEventForm } from './useEventForm';
import styles from './eventForm.module.scss';

export const EventForm: FC = () => {
  const {
    isLoading,
    isDisabled,
    handleSubmit,
    eventNameProps,
    placeProps,
    dateProps,
    timeProps,
    minimumProps,
  } = useEventForm();

  return (
    <ServiceForm method="post" onSubmit={handleSubmit} className={styles.form}>
      <Input className={styles.input} autoFocus autoComplete="eventName" {...eventNameProps} />
      <Input className={styles.input} autoComplete="place" {...placeProps} />
      <div className={styles.dateTime}>
        <Input className={styles.date} autoComplete="date" {...dateProps} type="date" />
        <Input className={styles.time} autoComplete="time" {...timeProps} type="time" />
      </div>
      <Input className={styles.input} autoComplete="minimum" {...minimumProps} type="number" min="0" max="20" />
      <Button type="submit" disabled={isDisabled} loading={isLoading} size="l" className={styles.createButton}>
        Создать матч
      </Button>
    </ServiceForm>
  );
};

export default EventForm;
