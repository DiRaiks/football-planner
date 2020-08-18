export interface IMainContainerProps extends React.HTMLAttributes<HTMLElement> {}
export interface IMainContainer extends React.ForwardRefRenderFunction<HTMLElement, IMainContainerProps> {}

export interface IContainerContentProps extends React.HTMLAttributes<HTMLElement> {}
export interface IContainerContent extends React.ForwardRefRenderFunction<HTMLElement, IContainerContentProps> {}

export interface IContainerInnerProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IContainerInner extends React.ForwardRefRenderFunction<HTMLDivElement, IContainerInnerProps> {}

export interface IContainerStickyProps extends React.HTMLAttributes<HTMLElement> {}
export interface IContainerSticky extends React.ForwardRefRenderFunction<HTMLElement, IContainerStickyProps> {}
