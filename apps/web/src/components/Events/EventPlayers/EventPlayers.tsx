import React, { FC, useEffect, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useObserver } from 'mobx-react';

import { PlayersStore, EventStore, UserStore } from 'store';
import EventForm from 'components/EventForm';
import { Button } from 'reusableComponents';

import Players from './playersTable/Players';
import CountInfo from './playersTable/CountInfo';
import PlayerForm from './playerForm';
import { IEventPlayersParams } from './types';
import styles from './playersTable/eventPlayers.module.scss';

const EventPlayers: FC<RouteComponentProps<IEventPlayersParams>> = props => {
  const { match } = props;
  const { eventId } = match.params;
  const [isEditEvent, setIsEditEvent] = useState(false);

  const userId = useObserver(() => UserStore.user?._id);
  const players = useObserver(() => PlayersStore.entities);
  const isPlayersPending = useObserver(() => PlayersStore.isPending);
  const event = useObserver(() => EventStore.entity);
  const isCanModifyEvent = useObserver(() => EventStore.isCanModify);
  const eventPending = useObserver(() => EventStore.isPending);
  const isCreator = userId === event?.creatorId;

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
        <Players players={players} isLoading={isPlayersPending} />
        {!eventPending && <CountInfo playersAmount={event?.playersAmount || 0} minimum={event?.minimum || 0} />}
      </div>
      {isCanModifyEvent && (
        <div className={styles.rightColumn}>
          {isCreator && !isEditEvent && (
            <Button className={styles.editEventButton} onClick={(): void => setIsEditEvent(true)}>
              Изменить событие
            </Button>
          )}
          {isEditEvent && (
            <EventForm
              eventId={eventId}
              onCancel={(): void => setIsEditEvent(false)}
              applyCallback={(): void => setIsEditEvent(false)}
            />
          )}
          <PlayerForm eventId={eventId} />
        </div>
      )}
    </div>
  );
};

export default EventPlayers;
