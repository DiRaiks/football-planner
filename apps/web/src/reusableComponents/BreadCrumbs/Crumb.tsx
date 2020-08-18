import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import cn from 'classnames';

import { ICrumb } from './types';

import styles from './crumb.module.scss';

const Crumb: ICrumb = (props, ref) => {
  const { className, href, children, ...rest } = props;
  const classes = cn(styles.crumb, className);

  return (
    <Link ref={ref} to={href} className={classes} {...rest}>
      {children}
    </Link>
  );
};

export default forwardRef(Crumb);
