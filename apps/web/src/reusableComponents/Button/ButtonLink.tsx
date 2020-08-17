import React, { forwardRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

import Loader from '../Loader';

import { IButtonLink } from './types';
import { useButton } from './useButton';

const ButtonLink: IButtonLink = (props, ref) => {
  const { rest, children, loaderSize, classes, styles } = useButton(props);
  const { disabled, loading, onClick } = props;

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (disabled) {
        event.preventDefault();

        return;
      }

      if (onClick) onClick(event);
    },
    [onClick, disabled],
  );

  return (
    <Link type="button" ref={ref} className={classes} {...rest} onClick={handleClick}>
      {loading && (
        <div className={styles.loader}>
          <Loader size={loaderSize} />
        </div>
      )}
      <span className={styles.content}>{children}</span>
    </Link>
  );
};

export default forwardRef(ButtonLink);
