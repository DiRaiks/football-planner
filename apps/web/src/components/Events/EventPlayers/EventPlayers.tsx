import React, { FC, useEffect } from 'react';
import { useObserver } from 'mobx-react';
import { PlayersStore } from 'store';

import Players from './Players';
import CountInfo from './CountInfo';
import styles from './eventPlayers.module.scss';

const EventPlayers: FC = props => {
  const players = useObserver(() => PlayersStore.entities);

  useEffect(() => {
    PlayersStore.updateEntities();

    return (): void => PlayersStore.resetEntities();
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.leftColumn}>
        <Players players={players} />
        <CountInfo players={players} playersAmount={1} minimum={12} />
      </div>
    </div>
  );
};

export default EventPlayers;
