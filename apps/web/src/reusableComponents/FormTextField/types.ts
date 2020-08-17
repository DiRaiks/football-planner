import { IInputProps } from '../Input/types';

export interface IFormTextFieldProps extends IInputProps {}
export interface IFormTextField extends React.ForwardRefRenderFunction<HTMLInputElement, IFormTextFieldProps> {}
