import { IPopoverProps } from '../Popover';
import { IIconProps } from '../Icon/types';

export type TPopupMenuRef = HTMLDivElement | null;

export interface IPopupMenuProps extends IPopoverProps {}
export interface IPopupMenu extends React.ForwardRefRenderFunction<HTMLDivElement, IPopupMenuProps> {}

export interface IPopupMenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IPopupMenuSeparator extends React.ForwardRefRenderFunction<HTMLDivElement, IPopupMenuSeparatorProps> {}

export interface IPopupMenuSearchProps extends React.HTMLAttributes<HTMLInputElement> {}
export interface IPopupMenuSearch extends React.ForwardRefRenderFunction<HTMLInputElement, IPopupMenuSearchProps> {}

export type TPopupMenuSearchRef = HTMLInputElement | null;

export interface IPopupMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: IIconProps['type'];
  disabled?: boolean;
  active?: boolean;
  rightDecorator?: JSX.Element;
}
export interface IPopupMenuItem<T = IPopupMenuItemProps> extends React.ForwardRefRenderFunction<HTMLDivElement, T> {}

export type TPopupMenuMouseMove = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
export type TPopupMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => void;

export type TSelectNext = (event: React.KeyboardEvent<HTMLDivElement>) => void;
export type TFocusOvered = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;

export type TUseKeyboard = (
  props: IPopupMenuProps,
  popupMenuRef: React.MutableRefObject<TPopupMenuRef>,
) => {
  handleKeyDown: TPopupMenuKeyDown;
  handleMouseMove: TPopupMenuMouseMove;
};

export type TPopupMenuItemHandleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
