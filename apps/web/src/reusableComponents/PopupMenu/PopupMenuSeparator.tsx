import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IPopupMenuSeparator } from './types';

import styles from './popupMenuSeparator.module.scss';

const PopupMenuSeparator: IPopupMenuSeparator = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.separator, className);

  return <div className={classes} ref={ref} {...rest} />;
};

export default forwardRef(PopupMenuSeparator);
