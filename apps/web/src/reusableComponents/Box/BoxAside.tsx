import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IBoxAside } from './types';

import styles from './boxAside.module.scss';

const BoxAside: IBoxAside = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.aside, className);

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
};

export default forwardRef(BoxAside);
