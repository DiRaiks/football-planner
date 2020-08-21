import React, { FC, useCallback, useEffect, useState, useRef } from 'react';
import cn from 'classnames';
import { PlayersStore } from 'store';
import { useObserver } from 'mobx-react';

import { ICountInfoProps } from './types';
import styles from './countInfo.module.scss';

const MAX_PLAYERS = 22;

const CountInfo: FC<ICountInfoProps> = props => {
  const { playersAmount, minimum } = props;
  const [chunkWidth, setChunkWidth] = useState(0);
  const allPlayers = useObserver(() => PlayersStore.allPlayers);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const width = wrapperRef.current?.getBoundingClientRect();
    setChunkWidth(width?.width || 0 / MAX_PLAYERS);
  }, []);

  const currentProgress = allPlayers.concat(new Array(MAX_PLAYERS - playersAmount).fill(0));
  const activeFiled = playersAmount >= minimum ? (playersAmount < MAX_PLAYERS ? 'miniField' : 'normalField') : '';

  const getChunkClasses = useCallback((item: Record<string, boolean>) => {
    if (!item) return { [styles.chunk]: true };

    return {
      [styles.chunk]: true,
      [styles.true]: item.status,
      [styles.maybe]: !item.status,
    };
  }, []);

  const getOptionClasses = useCallback(() => {
    return {
      [styles.optionsWr]: true,
      [styles.notEnough]: playersAmount < minimum,
      [`${activeFiled}`]: true,
    };
  }, [activeFiled, minimum, playersAmount]);

  const getTotalPlayersClasses = useCallback(() => {
    return {
      [styles.currentValue]: true,
      [styles.satisfied]: playersAmount >= minimum,
    };
  }, [minimum, playersAmount]);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div className={styles.countLine}>
        {currentProgress.map((item, index) => {
          return (
            <div
              key={index}
              style={{ flexGrow: chunkWidth ? 100 / chunkWidth : 0 }}
              className={cn(getChunkClasses(item)) || ''}
            />
          );
        })}
      </div>
      <div className={cn(getOptionClasses())}>
        <div className={styles.option}>
          Мало
          <br />
          игроков
        </div>
        <div className={styles.option}>
          Маленькое
          <br /> поле
        </div>
        <div className={styles.option}>
          Большое
          <br /> поле
        </div>
      </div>
      <div className={styles.totalInfo}>
        <div>Минимум: {minimum}</div>
        <div>
          Всего: <span className={cn(getTotalPlayersClasses())}>{playersAmount}</span>
        </div>
      </div>
    </div>
  );
};

export default CountInfo;
