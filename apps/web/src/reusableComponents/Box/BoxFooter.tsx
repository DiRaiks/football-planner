import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IBoxFooter } from './types';

import styles from './boxFooter.module.scss';

const BoxFooter: IBoxFooter = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.footer, className);

  return (
    <footer ref={ref} className={classes} {...rest}>
      {children}
    </footer>
  );
};

export default forwardRef(BoxFooter);
