import React, { FC } from 'react';
import cn from 'classnames';
import { Icon } from 'reusableComponents';

import { IPlayersRowProps } from './types';
import styles from './playersRow.module.scss';

const PlayersRow: FC<IPlayersRowProps> = props => {
  const { index, player } = props;
  const statusClasses = cn({
    [styles.status]: true,
    [styles.maybe]: !player.status,
  });

  const statusText = player.status ? 'Точно буду' : 'Может буду';

  return (
    <tr>
      <td>{index + 1}</td>
      <td className={statusClasses}>{statusText}</td>
      <td className={styles.name}>{player.name}</td>
      <td data-tooltip="Friends">
        {player.friends.map(({ name }, index) => (
          <Icon key={index} type="account" data-tooltip={name} />
        ))}
      </td>
    </tr>
  );
};

export default PlayersRow;
