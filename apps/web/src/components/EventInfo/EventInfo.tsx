import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { EventStore } from 'store';

import styles from './eventInfo.module.scss';

const EventInfo: FC = () => {
  const event = useObserver(() => EventStore.entity);

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.name}>{event?.eventName}</h2>
      <div className={styles.place}>{event?.place}</div>
      <div className={styles.date}>{new Date(event?.date || '').toLocaleDateString('ru-RU')}</div>
      <div className={styles.time}>{event?.time}</div>
    </div>
  );
};

export default EventInfo;
