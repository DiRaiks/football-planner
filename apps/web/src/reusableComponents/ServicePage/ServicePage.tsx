import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IServicePage } from './types';

import styles from './servicePage.module.scss';

const ServicePage: IServicePage = (props, ref) => {
  const { className, ...rest } = props;
  const classes = cn(styles.wrapper, className);

  return <div ref={ref} className={classes} {...rest} />;
};

export default forwardRef(ServicePage);
