import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { EventsStore } from 'store';

import Event from './Event';
import styles from './events.module.scss';
import { useEventActions } from './useEventActions';

export const OldEvents: FC = () => {
  const oldEvents = useObserver(() => EventsStore.oldEvents);
  const { openEventHandler, deleteEventHandler } = useEventActions();

  return (
    <div className={styles.wrapper}>
      {oldEvents.length !== 0 && <h3>Прошедшие матчи</h3>}
      {oldEvents.map(event => {
        return (
          <Event
            key={event._id}
            eventName={event.eventName}
            place={event.place}
            time={event.time}
            date={event.date}
            playersAmount={event.playersAmount}
            playersMinimum={event.minimum}
            onClick={(): void => openEventHandler(event._id)}
            onRemove={(): void => deleteEventHandler(event._id)}
            isDisabled
          />
        );
      })}
    </div>
  );
};

export default OldEvents;
