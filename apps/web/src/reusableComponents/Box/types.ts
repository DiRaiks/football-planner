export interface IBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'flat-gray' | 'shaded' | 'bordered';
  disabled?: boolean;
}
export interface IBox extends React.ForwardRefRenderFunction<HTMLDivElement, IBoxProps> {}

export interface IBoxHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IBoxHeader extends React.ForwardRefRenderFunction<HTMLDivElement, IBoxHeaderProps> {}

export interface IBoxMainProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IBoxMain extends React.ForwardRefRenderFunction<HTMLDivElement, IBoxMainProps> {}

export interface IBoxAsideProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IBoxAside extends React.ForwardRefRenderFunction<HTMLDivElement, IBoxAsideProps> {}

export interface IBoxFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IBoxFooter extends React.ForwardRefRenderFunction<HTMLDivElement, IBoxFooterProps> {}
