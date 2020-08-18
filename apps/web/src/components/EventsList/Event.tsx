import React, { FC } from 'react';
import { Box, BoxFooter, BoxHeader, BoxMain } from 'reusableComponents';
import PlayersAmount from 'components/PlayersAmount';

import { IEventProps } from './types';
import styles from './event.module.scss';

const Event: FC<IEventProps> = props => {
  const { eventName, playersAmount, date, place, playersMinimum, time, isDisabled = false } = props;

  return (
    <Box variant="flat-gray" className={styles.eventBox} disabled={isDisabled}>
      <BoxMain>
        <BoxHeader>{eventName}</BoxHeader>
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
