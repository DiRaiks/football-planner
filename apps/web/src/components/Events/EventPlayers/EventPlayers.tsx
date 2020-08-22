import React, { FC, useEffect } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useObserver } from 'mobx-react';

import { PlayersStore, EventStore } from 'store';

import Players from './playersTable/Players';
import CountInfo from './playersTable/CountInfo';
import PlayerForm from './playerForm';
import { IEventPlayersParams } from './types';
import styles from './playersTable/eventPlayers.module.scss';

const EventPlayers: FC<RouteComponentProps<IEventPlayersParams>> = props => {
  const { match } = props;
  const { eventId } = match.params;
  const players = useObserver(() => PlayersStore.entities);
  const event = useObserver(() => EventStore.entity);
  const eventPending = useObserver(() => EventStore.isPending);

  useEffect(() => {
    PlayersStore.setEventId(eventId);
    PlayersStore.updateEntities();
    EventStore.updateEvent(eventId);

    return (): void => {
      PlayersStore.resetEntities();
      EventStore.resetEntity();
    };
  }, [eventId]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.leftColumn}>
        <Players players={players} />
        {!eventPending && <CountInfo playersAmount={event?.playersAmount || 0} minimum={event?.minimum || 0} />}
      </div>
      <div className={styles.rightColumn}>
        <PlayerForm eventId={eventId} />
      </div>
    </div>
  );
};

export default EventPlayers;
