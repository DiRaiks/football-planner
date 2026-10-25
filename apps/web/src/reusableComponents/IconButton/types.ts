import { IButtonProps, IButton } from '../Button/types';
import { IIconProps } from '../Icon/types';

export interface IIconButtonProps extends IButtonProps {
  icon: IIconProps['type'];
}

export interface IIconButton extends IButton<IIconButtonProps> {}
