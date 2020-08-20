import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import cn from 'classnames';
import { useInterceptFocus } from 'hooks';

import Popover from '../Popover';

import { useKeyboard } from './useKeyboard';
import { IPopupMenu, TPopupMenuRef } from './types';

import styles from './popupMenu.module.scss';

const PopupMenu: IPopupMenu = (props, ref) => {
  const { className, onKeyDown, children, ...rest } = props;
  const classes = cn(styles.menu, className);

  // sync refs
  const popupMenuRef = useRef<TPopupMenuRef>(null);
  useImperativeHandle<TPopupMenuRef, TPopupMenuRef>(ref, () => popupMenuRef.current);

  const { handleKeyDown, handleMouseMove } = useKeyboard(props, popupMenuRef);
  useInterceptFocus(popupMenuRef);

  return (
    <Popover onKeyDown={handleKeyDown} onMouseMove={handleMouseMove} className={classes} ref={popupMenuRef} {...rest}>
      {children}
    </Popover>
  );
};

export default forwardRef(PopupMenu);
