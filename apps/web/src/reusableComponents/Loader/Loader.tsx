import React, { forwardRef } from 'react';
import cn from 'classnames';

import { ILoader } from './types';

import styles from './loader.module.scss';

const Loader: ILoader = (props, ref) => {
  const { className, size = 'm', color = 'current', ...rest } = props;

  const classes = cn(
    {
      [styles.loader]: true,
      [styles.main]: color === 'main',
      [styles.white]: color === 'white',
    },
    styles[`size-${size}`],
    className,
  );

  return <div ref={ref} className={classes} {...rest} />;
};

export default forwardRef(Loader);
