export type TColor = 'current' | 'main' | 'white';
export type TSize = 's' | 'm' | 'l';

export interface ILoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: TColor;
  size?: TSize;
}

export interface ILoader extends React.ForwardRefRenderFunction<HTMLDivElement, ILoaderProps> {}
