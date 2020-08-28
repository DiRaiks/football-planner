import React from 'react';
import { ContainerContent, CenterLoader } from 'reusableComponents';
import { useObserver } from 'mobx-react';

import { usePageEntitiesUpdate, useEntitiesPagination } from 'hooks';
import { EventsStore } from 'store';
import EventForm from 'components/EventForm';

import ActiveEvents from './ActiveEvents';
import OldEvents from './OldEvents';
import styles from './eventsList.module.scss';

export const EventsList: React.FC = () => {
  const search = usePageEntitiesUpdate(EventsStore, 'all');
  const pagination = useEntitiesPagination(EventsStore);
  const isEventsPending = useObserver(() => EventsStore.isPending);

  console.log('search, pagination', search, pagination);

  return (
    <ContainerContent>
      <div className={styles.wrapper}>
        <div className={styles.leftColumn}>
          {isEventsPending ? (
            <CenterLoader size="l" />
          ) : (
            <>
              <ActiveEvents />
              <OldEvents />
            </>
          )}
        </div>
        <div className={styles.rightColumn}>
          <h3>Новый матч</h3>
          <EventForm />
        </div>
      </div>
    </ContainerContent>
  );
};

export default EventsList;
