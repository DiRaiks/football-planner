import React, { FC, useCallback } from 'react';
import { Box, BoxFooter, BoxHeader, BoxMain, IconButton } from 'reusableComponents';
import PlayersAmount from 'components/PlayersAmount';

import { IEventProps } from './types';
import styles from './event.module.scss';

const Event: FC<IEventProps> = props => {
  const { eventName, playersAmount, date, place, playersMinimum, time, isDisabled = false, onClick, onRemove } = props;
  const onRemoveHandler = useCallback(
    (event: React.FormEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onRemove && onRemove();
    },
    [onRemove],
  );

  return (
    <Box variant="flat-gray" className={styles.eventBox} disabled={isDisabled} onClick={onClick}>
      <BoxMain>
        <BoxHeader className={styles.header}>
          {eventName}
          <IconButton
            className={styles.icon}
            data-tooltip="Удалить"
            size="s"
            type="button"
            color="gray"
            variant="ghost"
            icon="delete"
            onClick={onRemoveHandler}
          />
        </BoxHeader>
        <div>
          <span className={styles.fieldName}>Место: </span>
          {place}
        </div>
        <div>
          <span className={styles.fieldName}>Время: </span>
          {date}, {time}
        </div>
      </BoxMain>
      <BoxFooter>
        <PlayersAmount playersAmount={playersAmount} minimum={playersMinimum} />
      </BoxFooter>
    </Box>
  );
};

export default Event;
