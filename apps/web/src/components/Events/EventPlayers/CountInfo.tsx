import React, { FC, useCallback, useEffect, useState, useRef } from 'react';
import cn from 'classnames';
import { IPlayerModel } from 'store';

import { ICountInfoProps } from './types';
import styles from './countInfo.module.scss';

const MAX_PLAYERS = 22;

const CountInfo: FC<ICountInfoProps> = props => {
  const { playersAmount, players, minimum } = props;
  const [chunkWidth, setChunkWidth] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const width = wrapperRef.current?.getBoundingClientRect();
    setChunkWidth(width?.width || 0 / MAX_PLAYERS);
  }, []);

  const currentProgress = players.concat(new Array(MAX_PLAYERS - playersAmount).fill(0));
  const activeFiled = playersAmount >= minimum ? (playersAmount < MAX_PLAYERS ? 'miniField' : 'normalField') : '';

  const getChunkClasses = useCallback((item: IPlayerModel) => {
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

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div className={styles.countLine}>
        {currentProgress.map((item, index) => {
          return <div key={index} style={{ flexGrow: 100 / chunkWidth }} className={cn(getChunkClasses(item)) || ''} />;
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
    </div>
  );
};

export default CountInfo;
