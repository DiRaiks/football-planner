import { ITooltipConfig } from './types';

export const VIEWPORT_MARGIN = 8;

export const DEFAULT_CONFIG: ITooltipConfig = {
  onlyClipped: false,
  delay: 600,
  arrow: true,
  direction: 'top',
  offset: 8,
};

export const HIDDEN_STYLES = {
  top: '-9000px',
  right: 'auto',
  bottom: 'auto',
  left: '-9000px',
  opacity: 0,
  arrow: '100%',
};

export const AUTO_STYLES = {
  top: 'auto',
  right: 'auto',
  left: 'auto',
  bottom: 'auto',
  opacity: 1,
  arrow: '100%',
};
