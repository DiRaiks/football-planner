import React, { forwardRef } from 'react';
import cn from 'classnames';

import { SearchField } from 'reusableComponents';

import { IPopupMenuSearch } from './types';

import styles from './popupMenuSearch.module.scss';

const PopupMenuSearch: IPopupMenuSearch = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.wrapper, className);

  return (
    <div className={classes}>
      <SearchField className={styles.field} ref={ref} {...rest} />
    </div>
  );
};

export default forwardRef(PopupMenuSearch);
