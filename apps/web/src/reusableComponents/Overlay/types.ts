export type TGetValue = (value?: number) => string | undefined;

export interface IOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
export interface IOverlay extends React.ForwardRefRenderFunction<HTMLDivElement, IOverlayProps> {}
