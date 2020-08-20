export type TPopoverRef = HTMLDivElement | null;
export type TPopoverOutsideClick = (event: MouseEvent) => void;

export type TPosition = {
  top: number | undefined;
  right: number | undefined;
  bottom: number | undefined;
  left: number | undefined;
} | null;

export interface IPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  anchorRef: React.RefObject<HTMLElement | null>;
  anchorOriginVertical?: 'top' | 'bottom';
  anchorOriginHorizontal?: 'left' | 'right';
  anchorTransformVertical?: 'top' | 'bottom';
  anchorTransformHorizontal?: 'left' | 'right';
  onClose?: () => void;
}

export interface IPopover extends React.ForwardRefRenderFunction<HTMLDivElement, IPopoverProps> {}

export type TUseOutsideClick = (props: IPopoverProps, popoverRef: React.MutableRefObject<TPopoverRef>) => void;
export type TUsePosition = (props: IPopoverProps) => { position: TPosition };
