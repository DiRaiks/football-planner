import { IIconProps } from '../Icon/types';

export type THandleDelete = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
export type THandleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;

export interface IChipProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 's' | 'm';
  disabled?: boolean;
  lockDeletion?: boolean;
  onDelete?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  deleteButtonProps?: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
  icon?: IIconProps['type'];
  variant?: 'main' | 'gray' | 'foreground' | 'default';
}
export interface IChip extends React.ForwardRefRenderFunction<HTMLDivElement, IChipProps> {}

export interface IChipGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: IChipProps['size'];
}
export interface IChipGroup extends React.ForwardRefRenderFunction<HTMLDivElement, IChipGroupProps> {}
