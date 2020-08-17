import { useFocusWatcher } from 'hooks';
import cn from 'classnames';

import styles from './button.module.scss';
import { IButtonCommonProps, TUseButtonResult } from './types';

export const useButton = <T extends IButtonCommonProps>(props: T): TUseButtonResult<T> => {
  const {
    color = 'accent',
    size = 'm',
    variant = 'contained',
    active = false,
    selected = false,
    loading = false,
    disabled = false,
    className,
    children,
    ...rest
  } = props;

  useFocusWatcher();

  const classes = cn(
    {
      [styles.button]: true,
      [styles.disabled]: disabled || loading,
      [styles.loading]: loading,
      [styles.active]: active,
      [styles.selected]: selected,
      [styles.outlined]: variant === 'outlined',
      [styles.contained]: variant === 'contained',
      [styles.ghost]: variant === 'ghost',
    },
    styles[color],
    styles[`size-${size}`],
    className,
  );

  const loaderSize = size === 'xs' || size === 's' ? 's' : 'm';

  return { rest, classes, loaderSize, styles, children };
};
