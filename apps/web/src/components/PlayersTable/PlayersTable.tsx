import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { StickyLoader } from 'components/Loaders';
import { EventStore } from 'store';

import PlayersRow from './PlayersRow';
import CountInfo from './CountInfo';
import { IPlayersProps } from './types';
import styles from './playersTable.module.scss';

const PlayersTable: FC<IPlayersProps> = props => {
  const { players, isLoading = false } = props;

  const eventPending = useObserver(() => EventStore.isPending);
  const event = useObserver(() => EventStore.entity);

  return (
    <>
      <div className={styles.wrapper}>
        {isLoading && <StickyLoader />}
        <table className={styles.table}>
          <thead>
            <tr>
              <td>№</td>
              <td>Статус</td>
              <td className={styles.name}>Игрок</td>
              <td>Друзья</td>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <PlayersRow key={player._id} index={index} player={player} />
            ))}
          </tbody>
        </table>
      </div>
      {!eventPending && <CountInfo playersAmount={event?.playersAmount || 0} minimum={event?.minimum || 0} />}
    </>
  );
};

export default PlayersTable;
