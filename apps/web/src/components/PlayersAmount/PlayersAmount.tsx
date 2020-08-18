import React, { FC } from 'react';
import cn from 'classnames';

import { IActiveEventsProps } from './types';
import styles from './playersAmount.module.scss';

const PlayersAmount: FC<IActiveEventsProps> = props => {
  const { playersAmount, minimum } = props;
  const amountClasses = cn({
    [styles.playersAmount]: true,
    [styles.satisfied]: playersAmount >= minimum,
  });

  return (
    <div className={styles.wrapper}>
      <span className={amountClasses}>{playersAmount}</span> / <span className={styles.minimum}>{minimum}</span>
    </div>
  );
};

export default PlayersAmount;
