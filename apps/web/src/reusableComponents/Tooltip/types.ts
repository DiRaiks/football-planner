import { MutableRefObject } from 'react';

export type TUseTooltip = (ref: MutableRefObject<TTooltipRef>) => Partial<ITooltipStore>;

export type TTooltipRef = HTMLDivElement | null;
export type TTooltipTimer = number | undefined;

export interface ITooltipStore {
  targetRect: DOMRect;
  tooltipText: string;
  config: ITooltipConfig;
}

export type TTooltipGetValue = (value: number | null) => string;

export type TTooltipHandleOver = (event: MouseEvent) => void;
export type TTooltipHandleOut = (event: MouseEvent) => void;

export type TTooltipGetConfig = (target: Element | null) => ITooltipConfig | null;

export interface ITooltipConfig {
  delay: number;
  arrow: boolean;
  direction: 'top' | 'right' | 'bottom' | 'left';
  offset: number;
  onlyClipped: boolean;
}

export type TTooltipGetFirstPosition = (
  targetPosition: number,
  targetSize: number,
  tooltipSize: number,
  viewportSize: number,
) => [boolean, number, number];

export type TTooltipGetSecondPosition = (
  targetPosition: number,
  targetSize: number,
  tooltipSize: number,
  viewportSize: number,
  config: ITooltipConfig,
) => [boolean, number];

export interface ITooltipCSSData {
  top: string;
  right: string;
  bottom: string;
  left: string;
  opacity: number;
  arrow: string;
}

export type TSetCSSVariables = (element: TTooltipRef, data: ITooltipCSSData) => void;

export interface ITooltipProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface ITooltip extends React.ForwardRefRenderFunction<HTMLDivElement, ITooltipProps> {}
