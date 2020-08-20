import { IInputProps } from '../Input';

export interface ISearchFieldProps extends IInputProps {
  minLength?: number;
  onSearch?: (value: string) => void;
  onSearchInput?: (value: string) => void;
}
export interface ISearchField extends React.ForwardRefRenderFunction<HTMLInputElement, ISearchFieldProps> {}
export type TSearchInputRef = HTMLInputElement | null;
