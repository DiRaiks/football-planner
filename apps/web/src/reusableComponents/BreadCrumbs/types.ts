export interface ICrumbProps extends React.HTMLAttributes<HTMLAnchorElement> {
  href: string;
}
export interface ICrumb extends React.ForwardRefRenderFunction<HTMLAnchorElement, ICrumbProps> {}

export interface IBreadCrumbsProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface IBreadCrumbs extends React.ForwardRefRenderFunction<HTMLDivElement, IBreadCrumbsProps> {}
