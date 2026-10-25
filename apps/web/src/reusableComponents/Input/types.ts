export type TType = 'text' | 'password' | 'number' | 'email' | 'search' | 'tel' | 'url' | 'date' | 'time';

interface IInputCommonProps {
  label?: string;
  error?: boolean;
  hasLeftDecorator?: boolean;
  hasRightDecorator?: boolean;
}

export interface IInputProps extends React.InputHTMLAttributes<HTMLInputElement>, IInputCommonProps {
  active?: boolean;
  type?: TType;
}

export interface ITextareaProps extends React.InputHTMLAttributes<HTMLTextAreaElement>, IInputCommonProps {}

export interface IInput extends React.ForwardRefRenderFunction<HTMLInputElement, IInputProps> {}
export interface ITextarea extends React.ForwardRefRenderFunction<HTMLTextAreaElement, ITextareaProps> {}
