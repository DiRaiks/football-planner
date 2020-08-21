import React, { FC } from 'react';

import PlayersRow from './PlayersRow';
import { IPlayersProps } from './types';
import styles from './players.module.scss';

const Players: FC<IPlayersProps> = props => {
  const { players } = props;

  return (
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
  );
};

export default Players;
