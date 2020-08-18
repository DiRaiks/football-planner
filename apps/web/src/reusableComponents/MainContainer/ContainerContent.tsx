import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IContainerContent } from './types';

import styles from './containerContent.module.scss';

const ContainerContent: IContainerContent = (props, ref) => {
  const { className, ...rest } = props;
  const classes = cn(styles.content, className);

  return <section ref={ref} className={classes} {...rest} />;
};

export default forwardRef(ContainerContent);
