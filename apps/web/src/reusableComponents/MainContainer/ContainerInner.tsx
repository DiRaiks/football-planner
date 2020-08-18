import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IContainerInner } from './types';

import styles from './containerInner.module.scss';

const ContainerInner: IContainerInner = (props, ref) => {
  const { className, ...rest } = props;
  const classes = cn(styles.inner, className);

  return <div ref={ref} className={classes} {...rest} />;
};

export default forwardRef(ContainerInner);
