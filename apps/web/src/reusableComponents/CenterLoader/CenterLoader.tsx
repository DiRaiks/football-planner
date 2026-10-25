import React, { forwardRef } from 'react';
import cn from 'classnames';

import Loader from '../Loader';

import { ICenterLoader } from './types';
import styles from './centerLoader.module.scss';

const CenterLoader: ICenterLoader = (props, ref) => {
  const { className, size, color = 'main', loaderClassName, ...rest } = props;
  const classes = cn(styles.wrapper, className);

  return (
    <div ref={ref} className={classes} {...rest}>
      <Loader size={size} color={color} className={loaderClassName} />
    </div>
  );
};

export default forwardRef(CenterLoader);
