import {
  TTooltipGetValue,
  TTooltipGetConfig,
  TTooltipGetFirstPosition,
  TTooltipGetSecondPosition,
  TSetCSSVariables,
} from './types';
import { VIEWPORT_MARGIN } from './constants';

export const setCSSVariables: TSetCSSVariables = (element, data) => {
  if (!element) return;

  element.style.setProperty('--top', data.top);
  element.style.setProperty('--right', data.right);
  element.style.setProperty('--bottom', data.bottom);
  element.style.setProperty('--left', data.left);
  element.style.setProperty('--opacity', String(data.opacity));
  element.style.setProperty('--arrow', data.arrow);
};

export const getValue: TTooltipGetValue = value => (value === null ? 'auto' : `${value}px`);

export const getConfig: TTooltipGetConfig = target => {
  if (!target) return null;
  const config = target.getAttribute('data-tooltip-config') || '';

  try {
    return JSON.parse(config);
  } catch (error) {
    return null;
  }
};

export const getFirstPosition: TTooltipGetFirstPosition = (targetPosition, targetSize, tooltipSize, viewportSize) => {
  const targetCenter = (targetPosition + targetPosition + targetSize) / 2;
  const tooltipHalfSize = tooltipSize / 2;

  const position = Math.max(VIEWPORT_MARGIN, targetCenter - tooltipHalfSize);
  const isReachTheEdge = position > VIEWPORT_MARGIN && position + tooltipSize > viewportSize - VIEWPORT_MARGIN;

  const arrowLength = (targetCenter - position) * 2;
  const edgeArrowLength = (viewportSize - targetCenter - VIEWPORT_MARGIN) * 2;

  return isReachTheEdge ? [false, VIEWPORT_MARGIN, edgeArrowLength] : [true, position, arrowLength];
};

export const getSecondPosition: TTooltipGetSecondPosition = (
  targetPosition,
  targetSize,
  tooltipSize,
  viewportSize,
  config,
) => {
  const targetEnd = targetPosition + targetSize;

  const position = targetEnd + config.offset;
  const invertPosition = viewportSize - targetPosition + config.offset;
  const needInvert =
    position + tooltipSize + VIEWPORT_MARGIN > viewportSize &&
    invertPosition + tooltipSize + VIEWPORT_MARGIN < viewportSize;

  return needInvert ? [false, invertPosition] : [true, position];
};
