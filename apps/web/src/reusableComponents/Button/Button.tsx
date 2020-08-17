import React, { forwardRef } from 'react';

import Loader from '../Loader';

import { IButton } from './types';
import { useButton } from './useButton';

const Button: IButton = (props, ref) => {
  const { rest, children, loaderSize, classes, styles } = useButton(props);
  const { disabled, loading } = props;

  return (
    <button type="button" ref={ref} disabled={disabled || loading} className={classes} {...rest}>
      {loading && (
        <div className={styles.loader}>
          <Loader size={loaderSize} />
        </div>
      )}
      <span className={styles.content}>{children}</span>
    </button>
  );
};

export default forwardRef(Button);
