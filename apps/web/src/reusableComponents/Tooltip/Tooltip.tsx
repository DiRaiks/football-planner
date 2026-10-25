import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import cn from 'classnames';
import { CSSTransition, TransitionGroup } from 'react-transition-group';

import { useTooltip } from './useTooltip';
import { ITooltip, TTooltipRef } from './types';

import styles from './tooltip.module.scss';
import transition from './transition.module.scss';

const Tooltip: ITooltip = (props, ref) => {
  const { className, children, ...rest } = props;
  const classes = cn(styles.tooltip, className);

  // sync refs
  const tooltipRef = useRef<TTooltipRef>(null);
  useImperativeHandle<TTooltipRef, TTooltipRef>(ref, () => tooltipRef.current);

  const { tooltipText, config } = useTooltip(tooltipRef);

  return (
    <TransitionGroup>
      {tooltipText && (
        <CSSTransition key={tooltipText} appear unmountOnExit mountOnEnter timeout={200} classNames={transition}>
          <div ref={tooltipRef} className={classes} {...rest}>
            {config?.arrow && <div className={styles.arrow} />}
            <div className={styles.content}>{tooltipText}</div>
          </div>
        </CSSTransition>
      )}
    </TransitionGroup>
  );
};

export default forwardRef(Tooltip);
