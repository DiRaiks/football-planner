import React, { forwardRef } from 'react';
import cn from 'classnames';
import { Input } from 'reusableComponents';

import { IPlayerInput } from './types';
import styles from './playerInput.module.scss';

const PlayerInput: IPlayerInput = (props, ref) => {
  const { status, onStatusChange, ...rest } = props;

  const statusHandler = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
    if ((event.target as HTMLDivElement).closest(`.${styles.maybe}`)) onStatusChange(false);
    else if ((event.target as HTMLDivElement).closest(`.${styles.true}`)) onStatusChange(true);
  };

  const maybeClasses = cn({
    [styles.option]: true,
    [styles.maybe]: true,
    [styles.active]: !status,
  });

  const trueClasses = cn({
    [styles.option]: true,
    [styles.true]: true,
    [styles.active]: status,
  });

  return (
    <div className={styles.wrapper}>
      <Input className={styles.input} ref={ref} {...rest} />
      <div className={styles.status} onClick={statusHandler}>
        <div className={trueClasses}>Точно буду</div>
        <div className={maybeClasses}>Может буду</div>
      </div>
    </div>
  );
};

export default forwardRef(PlayerInput);
