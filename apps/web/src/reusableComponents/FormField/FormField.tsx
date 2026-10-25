import React, { Children, cloneElement, forwardRef } from 'react';
import { isReactElement } from 'utils';
import cn from 'classnames';

import { IFormField } from './types';

import styles from './formField.module.scss';

const FormField: IFormField = (props, ref) => {
  const { className, children, leftDecorator, rightDecorator, ...rest } = props;
  const hasLeftDecorator = !!leftDecorator;
  const hasRightDecorator = !!rightDecorator;
  const classes = cn(styles.wrapper, className);

  return (
    <div ref={ref} className={classes} {...rest}>
      {hasLeftDecorator && <div className={styles['left-decorator']}>{leftDecorator}</div>}
      {Children.map(children, child => {
        if (!isReactElement(child)) return child;

        return cloneElement(child, {
          hasLeftDecorator,
          hasRightDecorator,
          className: cn(styles.input, child.props.className),
        });
      })}
      {hasRightDecorator && <div className={styles['right-decorator']}>{rightDecorator}</div>}
    </div>
  );
};

export default forwardRef(FormField);
