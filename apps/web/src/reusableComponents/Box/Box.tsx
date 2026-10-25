import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IBox } from './types';

import styles from './box.module.scss';

const Box: IBox = (props, ref) => {
  const { className, variant = 'flat', disabled = false, onClick, children, ...rest } = props;
  const classes = cn(
    {
      [styles.wrapper]: true,
      [styles.flat]: variant === 'flat',
      [styles.gray]: variant === 'flat-gray',
      [styles.bordered]: variant === 'bordered',
      [styles.shaded]: variant === 'shaded',
      [styles.disabled]: disabled,
      [styles.interactive]: !!onClick,
    },
    className,
  );

  return (
    <div ref={ref} className={classes} onClick={onClick} {...rest}>
      {children}
    </div>
  );
};

export default forwardRef(Box);
