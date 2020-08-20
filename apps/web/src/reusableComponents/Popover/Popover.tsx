import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import cn from 'classnames';
import { useEscape } from 'hooks';

import Overlay from '../Overlay';

import { IPopover, TPopoverRef } from './types';
import { useOutsideClick } from './useOutsideClick';

import styles from './popover.module.scss';
import { usePosition } from './usePosition';

const Popover: IPopover = (props, ref) => {
  const {
    className,
    anchorRef,
    anchorOriginVertical,
    anchorOriginHorizontal,
    anchorTransformVertical,
    anchorTransformHorizontal,
    onKeyDown,
    onClose,
    ...rest
  } = props;

  // sync refs
  const popoverRef = useRef<TPopoverRef>(null);
  useImperativeHandle<TPopoverRef, TPopoverRef>(ref, () => popoverRef.current);

  const { handleKeyDown } = useEscape(props);
  const { position } = usePosition(props);
  useOutsideClick(props, popoverRef);

  if (!position) return null;

  const classes = cn(styles.popover, className);

  return (
    <Overlay {...position}>
      <div tabIndex={-1} onKeyDown={handleKeyDown} className={classes} ref={popoverRef} {...rest} />
    </Overlay>
  );
};

export default forwardRef(Popover);
