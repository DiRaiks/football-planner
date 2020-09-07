import React, { FC, useEffect, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useObserver } from 'mobx-react';

import { PlayersStore, EventStore, UserStore } from 'store';
import EventForm from 'components/EventForm';
import EventInfo from 'components/EventInfo';
import PlayerForm from 'components/PlayerForm';
import PlayersTable from 'components/PlayersTable';
import { Button } from 'reusableComponents';

import { IEventPlayersParams } from './types';
import styles from './eventPlayers.module.scss';

const EventPlayers: FC<RouteComponentProps<IEventPlayersParams>> = props => {
  const { match } = props;
  const { eventId } = match.params;
  const [isEditEvent, setIsEditEvent] = useState(false);

  const userId = useObserver(() => UserStore.user?._id);
  const players = useObserver(() => PlayersStore.entities);
  const isPlayersPending = useObserver(() => PlayersStore.isPending);
  const event = useObserver(() => EventStore.entity);
  const isCanModifyEvent = useObserver(() => EventStore.isCanModify);
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
        <EventInfo />
        <PlayersTable players={players} isLoading={isPlayersPending} />
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
