import { NavLinkProps } from 'react-router-dom';

import { ILoaderProps } from '../Loader';

export type TButtonSize = 'xs' | 's' | 'm' | 'l';
export type TButtonVariant = 'outlined' | 'contained' | 'ghost';
export type TButtonColor = 'accent' | 'gray' | 'warning' | 'highlight';

export interface IButtonCommonProps {
  color?: TButtonColor;
  loading?: boolean;
  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  variant?: TButtonVariant;
  size?: TButtonSize;
  className?: string;
  children?: React.ReactNode;
}

export interface IButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    IButtonCommonProps {}

export interface IButton<T = IButtonProps> extends React.ForwardRefRenderFunction<HTMLButtonElement, T> {}

export interface IButtonLinkProps extends Omit<NavLinkProps, 'color'>, IButtonCommonProps {}

export interface IButtonLink<T = IButtonLinkProps> extends React.ForwardRefRenderFunction<HTMLAnchorElement, T> {}

export type TUseButtonResult<T> = {
  rest: Omit<T, keyof IButtonCommonProps>;
  classes: string;
  loaderSize: ILoaderProps['size'];
  styles: Record<string, string>;
  children?: React.ReactNode;
};
