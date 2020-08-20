import React, { forwardRef } from 'react';
import ReactDOM from 'react-dom';
import cn from 'classnames';

import ModalRoot from '../ModalRoot';

import { TGetValue, IOverlay } from './types';

import styles from './overlay.module.scss';

const OFFSET = 8;

const getValue: TGetValue = value => {
  if (value === null || value === undefined) return undefined;
  if (Number.isFinite(Number(value))) return `${String(value - OFFSET)}px`;

  return String(value);
};

const Overlay: IOverlay = (props, ref) => {
  const { top, right, bottom, left, className, ...rest } = props;
  const topPx = getValue(top);
  const rightPx = getValue(right);
  const bottomPx = getValue(bottom);
  const leftPx = getValue(left);

  const isRight = rightPx !== undefined;
  const isBottom = bottomPx !== undefined;

  const xClasses = cn(styles['x-axis'], { [styles.right]: isRight });
  const yClasses = cn(styles['y-axis'], { [styles.bottom]: isBottom });

  const xStyle = { flexBasis: isRight ? rightPx : leftPx };
  const yStyle = { flexBasis: isBottom ? bottomPx : topPx };

  const classes = cn(styles.element, className);

  return ReactDOM.createPortal(
    <div className={xClasses}>
      <div className={styles.margin} style={xStyle} />

      <div className={yClasses}>
        <div className={styles.margin} style={yStyle} />
        <div className={classes} ref={ref} {...rest} />
      </div>
    </div>,
    ModalRoot,
  );
};

export default forwardRef(Overlay);
