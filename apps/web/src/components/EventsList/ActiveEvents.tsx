import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { EventsStore } from 'store';

import Event from './Event';

export const ActiveEvents: FC = () => {
  const activeEvents = useObserver(() => EventsStore.activeEvents);

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
          />
        );
      })}
    </div>
  );
};

export default ActiveEvents;
