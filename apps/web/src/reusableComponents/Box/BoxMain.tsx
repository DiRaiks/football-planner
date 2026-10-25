import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IBoxMain } from './types';

import styles from './boxMain.module.scss';

const BoxMain: IBoxMain = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.main, className);

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
};

export default forwardRef(BoxMain);
