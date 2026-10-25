import React, { forwardRef } from 'react';
import cn from 'classnames';

import { ITextarea } from './types';

import styles from './input.module.scss';

const Textarea: ITextarea = (props, ref) => {
  const {
    className,
    placeholder,
    label,
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
      [styles.error]: error,
      [styles.hasLeftDecorator]: hasLeftDecorator,
      [styles.hasRightDecorator]: hasRightDecorator,
    },
    className,
  );

  return (
    <label className={classes}>
      <textarea placeholder={replacedPlaceholder} ref={ref} className={styles.input} {...rest} />
      {hasLabel && <span className={styles.title}>{label}</span>}
    </label>
  );
};

export default forwardRef(Textarea);
