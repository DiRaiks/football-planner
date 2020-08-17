import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IServiceForm } from './types';

import styles from './serviceForm.module.scss';

const ServiceForm: IServiceForm = (props, ref) => {
  const { className, ...rest } = props;
  const classes = cn(styles.wrapper, className);

  return <form ref={ref} className={classes} {...rest} />;
};

export default forwardRef(ServiceForm);
