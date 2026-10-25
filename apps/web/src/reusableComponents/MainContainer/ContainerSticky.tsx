import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IContainerSticky } from './types';

import styles from './containerSticky.module.scss';

const ContainerSticky: IContainerSticky = (props, ref) => {
  const { className, ...rest } = props;
  const classes = cn(styles.sticky, className);

  return <section ref={ref} className={classes} {...rest} />;
};

export default forwardRef(ContainerSticky);
