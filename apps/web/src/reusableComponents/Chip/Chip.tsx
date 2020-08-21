import React, { forwardRef, useCallback } from 'react';
import cn from 'classnames';

import Icon from '../Icon';

import { IChip, THandleClick, THandleDelete } from './types';

import styles from './chip.module.scss';

const Chip: IChip = (props, ref) => {
  const {
    className,
    children,
    disabled = false,
    lockDeletion = false,
    size = 'm',
    deleteButtonProps,
    onDelete,
    onClick,
    icon,
    variant = 'default',
    ...rest
  } = props;

  const classes = cn(
    {
      [styles.chip]: true,
      [styles.interactive]: !disabled && !!onClick,
      [styles.main]: variant === 'main',
      [styles.gray]: variant === 'gray',
      [styles.foreground]: variant === 'foreground',
      [styles.default]: variant === 'default',
    },
    styles[`size-${size}`],
    className,
  );

  const handleClick: THandleClick = useCallback(
    event => {
      if (disabled) return;
      if (onClick) onClick(event);
    },
    [disabled, onClick],
  );

  const handleDelete: THandleDelete = useCallback(
    event => {
      if (lockDeletion) return;
      if (onDelete) onDelete(event);
      event.stopPropagation();
    },
    [lockDeletion, onDelete],
  );

  return (
    <div ref={ref} onClick={handleClick} className={classes} {...rest}>
      {icon && <Icon className={styles.icon} type={icon} />}
      <div className={styles.content}>{children}</div>
      {onDelete && (
        <button
          type="button"
          tabIndex={-1}
          className={styles.delete}
          disabled={lockDeletion}
          onClick={handleDelete}
          {...deleteButtonProps}
        >
          <Icon className={styles['delete-icon']} type="clear" />
        </button>
      )}
    </div>
  );
};

export default forwardRef(Chip);
