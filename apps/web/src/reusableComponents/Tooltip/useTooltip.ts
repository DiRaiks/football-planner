import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';

import { DEFAULT_CONFIG, HIDDEN_STYLES, AUTO_STYLES } from './constants';
import { getValue, getConfig, getFirstPosition, getSecondPosition, setCSSVariables } from './utils';
import {
  ITooltipConfig,
  TUseTooltip,
  TTooltipTimer,
  ITooltipStore,
  TTooltipHandleOver,
  TTooltipHandleOut,
} from './types';

const { setTimeout } = window;

export const useTooltip: TUseTooltip = ref => {
  const [tooltip, setTooltip] = useState<ITooltipStore | null>(null);
  const timer = useRef<TTooltipTimer>(undefined);

  useLayoutEffect(() => {
    if (!tooltip || !ref.current) return;

    const { targetRect, config } = tooltip;

    const tooltipRect = ref.current.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    const styles = { ...AUTO_STYLES };

    const isTop = config.direction === 'top';
    const isRight = config.direction === 'right';
    const isBottom = config.direction === 'bottom';
    const isLeft = config.direction === 'left';

    const targetTop = targetRect.top;
    const targetRight = targetRect.right;
    const targetBottom = targetRect.bottom;
    const targetLeft = targetRect.left;
    const targetWidth = targetRect.width;
    const targetHeight = targetRect.height;

    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let direction = config.direction;
    let inverse = false;

    if (isLeft || isRight) {
      const [direct, y, arrow] = getFirstPosition(targetTop, targetHeight, tooltipHeight, winHeight);
      styles[direct ? 'top' : 'bottom'] = getValue(y);
      styles.arrow = getValue(arrow);
      inverse = !direct;
    }

    if (isTop || isBottom) {
      const [direct, x, arrow] = getFirstPosition(targetLeft, targetWidth, tooltipWidth, winWidth);
      styles[direct ? 'left' : 'right'] = getValue(x);
      styles.arrow = getValue(arrow);
      inverse = !direct;
    }

    if (isLeft) {
      const [direct, x] = getSecondPosition(winWidth - targetRight, targetWidth, tooltipWidth, winWidth, config);
      styles[direct ? 'right' : 'left'] = getValue(x);
      if (!direct) direction = 'right';
    }

    if (isRight) {
      const [direct, x] = getSecondPosition(targetLeft, targetWidth, tooltipWidth, winWidth, config);
      styles[direct ? 'left' : 'right'] = getValue(x);
      if (!direct) direction = 'left';
    }

    if (isTop) {
      const [direct, y] = getSecondPosition(winHeight - targetBottom, targetHeight, tooltipHeight, winHeight, config);
      styles[direct ? 'bottom' : 'top'] = getValue(y);
      if (!direct) direction = 'bottom';
    }

    if (isBottom) {
      const [direct, y] = getSecondPosition(targetTop, targetHeight, tooltipHeight, winHeight, config);
      styles[direct ? 'top' : 'bottom'] = getValue(y);
      if (!direct) direction = 'top';
    }

    setCSSVariables(ref.current, styles);
    ref.current.setAttribute('data-direction', direction);
    ref.current.toggleAttribute('data-inverse', inverse);
  }, [ref, tooltip]);

  const handleOver: TTooltipHandleOver = useCallback(
    event => {
      clearTimeout(timer.current);
      const { target } = event;

      const tooltipTarget = target instanceof Element ? target?.closest('[data-tooltip]') : null;
      const tooltipText = tooltipTarget ? tooltipTarget.getAttribute('data-tooltip') : null;
      const tooltipConfig = getConfig(tooltipTarget);

      const config: ITooltipConfig = { ...DEFAULT_CONFIG, ...tooltipConfig };

      if (!tooltipText) return setTooltip(null);

      if (tooltipTarget && tooltipConfig?.onlyClipped) {
        const { scrollWidth = 0, clientWidth = 0 } = tooltipTarget;
        const isNotClipped = scrollWidth <= clientWidth;

        if (isNotClipped) return setTooltip(null);
      }

      timer.current = setTimeout(() => {
        const targetRect = tooltipTarget?.getBoundingClientRect();
        if (!targetRect) return;

        // Reset tooltip styles for correct size calculation
        setCSSVariables(ref.current, HIDDEN_STYLES);

        setTooltip({ config, targetRect, tooltipText });
      }, config.delay);
    },
    [ref],
  );

  const handleOut: TTooltipHandleOut = useCallback(() => {
    clearTimeout(timer.current);
    setTooltip(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mouseout', handleOut);

    return (): void => {
      clearTimeout(timer.current);
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mouseout', handleOut);
    };
  }, [handleOver, handleOut]);

  return { ...tooltip };
};
