import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IBoxHeader } from './types';

import styles from './boxHeader.module.scss';

const BoxHeader: IBoxHeader = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.header, className);

  return (
    <header ref={ref} className={classes} {...rest}>
      {children}
    </header>
  );
};

export default forwardRef(BoxHeader);
