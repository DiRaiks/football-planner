import React, { Children, cloneElement, forwardRef } from 'react';
import { isReactElement } from 'utils';
import cn from 'classnames';

import Icon from '../Icon';

import { IBreadCrumbs } from './types';

import styles from './breadCrumbs.module.scss';

const BreadCrumbs: IBreadCrumbs = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.group, className);

  return (
    <div ref={ref} className={classes} {...rest}>
      {Children.map(children, child => {
        if (!isReactElement(child)) return child;
        const className = cn(child.props.className);

        return (
          <div className={styles.item}>
            {cloneElement(child, { className })}
            <Icon className={styles.icon} type="right" />
          </div>
        );
      })}
    </div>
  );
};

export default forwardRef(BreadCrumbs);
