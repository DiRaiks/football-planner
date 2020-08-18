import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { EventsStore } from 'store';

import Event from './Event';
import { useEventActions } from './useEventActions';

const ActiveEvents: FC = () => {
  const activeEvents = useObserver(() => EventsStore.activeEvents);
  const { openEventHandler, deleteEventHandler } = useEventActions();

  return (
    <div>
      {activeEvents.length !== 0 && <h3>Активные матчи</h3>}
      {activeEvents.map(event => {
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
          />
        );
      })}
    </div>
  );
};

export default ActiveEvents;
