import React, { forwardRef } from 'react';
import cn from 'classnames';

import Button from '../Button';
import Icon from '../Icon';

import { IIconButton } from './types';

import styles from './iconButton.module.scss';

const IconButton: IIconButton = (props, ref) => {
  const { icon, size = 'm', className, children, ...rest } = props;
  const hasChildren = children && React.Children.count(children) > 0;
  const classes = cn(
    {
      [styles.button]: true,
      [styles.rounded]: !hasChildren,
    },
    styles[`size-${size}`],
    className,
  );

  return (
    <Button className={classes} size={size} ref={ref} {...rest}>
      <Icon className={styles.icon} type={icon} />
      {hasChildren && <span className={styles.content}>{children}</span>}
    </Button>
  );
};

export default forwardRef(IconButton);
