import { IInputProps } from 'reusableComponents/Input/types';

export interface IPlayerInputProps extends IInputProps {
  status: boolean;
  onStatusChange: (status: boolean) => void;
}
export interface IPlayerInput extends React.ForwardRefRenderFunction<HTMLInputElement, IPlayerInputProps> {}
