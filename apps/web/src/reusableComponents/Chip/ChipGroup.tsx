import React, { Children, cloneElement, forwardRef } from 'react';
import { isReactElement } from 'utils';
import cn from 'classnames';

import { IChipGroup } from './types';

import styles from './chipGroup.module.scss';

const ChipGroup: IChipGroup = (props, ref) => {
  const { className, children, size = 's', ...rest } = props;
  const classes = cn(styles.group, styles[`size-${size}`], className);

  return (
    <div ref={ref} className={classes} {...rest}>
      {Children.map(children, child => {
        if (!isReactElement(child)) return child;
        const className = cn(styles.item, child.props.className);

        return cloneElement(child, { className });
      })}
    </div>
  );
};

export default forwardRef(ChipGroup);
