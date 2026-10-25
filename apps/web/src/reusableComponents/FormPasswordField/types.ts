import { IInputProps } from '../Input/types';

export interface IFormPasswordFieldProps extends IInputProps {}
export interface IFormPasswordField extends React.ForwardRefRenderFunction<HTMLInputElement, IFormPasswordFieldProps> {}
export type TInputRef = HTMLInputElement | null;
