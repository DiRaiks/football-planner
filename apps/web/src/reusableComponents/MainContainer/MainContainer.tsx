import React, { forwardRef } from 'react';
import cn from 'classnames';

import { IMainContainer } from './types';

import styles from './mainContainer.module.scss';

const MainContainer: IMainContainer = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.wrapper, className);

  return (
    <main ref={ref} className={classes} {...rest}>
      <section className={styles.content}>{children}</section>
    </main>
  );
};

export default forwardRef(MainContainer);
