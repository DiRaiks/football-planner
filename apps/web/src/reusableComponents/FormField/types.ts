export interface IFormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  leftDecorator?: JSX.Element;
  rightDecorator?: JSX.Element;
}

export interface IFormField extends React.ForwardRefRenderFunction<HTMLDivElement, IFormFieldProps> {}
