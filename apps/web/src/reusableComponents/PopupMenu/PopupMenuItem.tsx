import React, { forwardRef, useCallback } from 'react';
import cn from 'classnames';

import Icon from '../Icon';

import { IPopupMenuItem, TPopupMenuItemHandleClick } from './types';

import styles from './popupMenuItem.module.scss';

const PopupMenuItem: IPopupMenuItem = (props, ref) => {
  const { className, rightDecorator, disabled = false, onClick, active = false, icon, children, ...rest } = props;
  const isInteractive = !!onClick;
  const classes = cn(
    {
      [styles.item]: true,
      [styles.disabled]: disabled,
      [styles.active]: active,
      [styles.interactive]: isInteractive,
    },
    className,
  );

  const additional: React.HTMLAttributes<HTMLDivElement> = {};
  if (disabled) additional['aria-disabled'] = true;

  const handleClick: TPopupMenuItemHandleClick = useCallback(
    event => {
      if (disabled) return;
      if (onClick) onClick(event);
    },
    [onClick, disabled],
  );

  return (
    <div
      tabIndex={isInteractive ? -1 : undefined}
      className={classes}
      ref={ref}
      onClick={handleClick}
      {...additional}
      {...rest}
    >
      {!!icon && <Icon type={icon} className={styles.icon} />}
      <span className={styles.title}>{children}</span>
      {rightDecorator && <span className={styles.rightDecorator}>{rightDecorator}</span>}
    </div>
  );
};

export default forwardRef(PopupMenuItem);
