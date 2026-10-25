import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IInput } from './types';

import styles from './input.module.scss';

const Input: IInput = (props, ref) => {
  const {
    className,
    placeholder,
    label,
    active = false,
    error = false,
    hasLeftDecorator = false,
    hasRightDecorator = false,
    ...rest
  } = props;

  const replacedPlaceholder = label ? ' ' : placeholder;
  const hasLabel = !!label;

  const classes = cn(
    {
      [styles.wrapper]: true,
      [styles.labeled]: hasLabel,
      [styles.active]: active,
      [styles.error]: error,
      [styles['with-left-decorator']]: hasLeftDecorator,
      [styles['with-right-decorator']]: hasRightDecorator,
    },
    className,
  );

  return (
    <label className={classes}>
      <input placeholder={replacedPlaceholder} ref={ref} className={styles.input} {...rest} />
      {hasLabel && <span className={styles.title}>{label}</span>}
    </label>
  );
};

export default forwardRef(Input);
