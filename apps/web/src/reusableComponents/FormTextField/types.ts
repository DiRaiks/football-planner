import { IInputProps } from 'reusableComponents/Input/types';

export interface IFormTextFieldProps extends IInputProps {}
export interface IFormTextField extends React.ForwardRefRenderFunction<HTMLInputElement, IFormTextFieldProps> {}
