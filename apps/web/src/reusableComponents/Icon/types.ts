import { TIconType } from './iconsDefs';

export interface IIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'type' | 'css' | 'path' | 'crossOrigin'> {
  type: TIconType | 'empty';
  viewBox?: string;
}

export interface IIcon extends React.ForwardRefRenderFunction<SVGSVGElement, IIconProps> {}
