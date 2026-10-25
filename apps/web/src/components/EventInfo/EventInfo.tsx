import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { EventStore } from 'store';
import Weather from 'components/Weather';

import styles from './eventInfo.module.scss';

const EventInfo: FC = () => {
  const event = useObserver(() => EventStore.entity);

  if (!event) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.info}>
        <h2 className={styles.name}>{event.eventName}</h2>
        <div className={styles.place}>{event.place}</div>
        <div className={styles.date}>{new Date(event.date || '').toLocaleDateString('ru-RU')}</div>
        <div className={styles.time}>{event.time}</div>
      </div>
      <div className={styles.weather}>
        <Weather date={event.date} />
      </div>
    </div>
  );
};

export default EventInfo;
