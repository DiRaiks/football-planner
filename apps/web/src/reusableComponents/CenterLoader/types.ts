import { ILoaderProps } from '../Loader';

export interface ICenterLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: ILoaderProps['color'];
  size?: ILoaderProps['size'];
  loaderClassName?: ILoaderProps['className'];
}

export interface ICenterLoader extends React.ForwardRefRenderFunction<HTMLDivElement, ICenterLoaderProps> {}
