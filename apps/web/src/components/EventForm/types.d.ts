export type TEventFormSubmit = (event: React.FormEvent<HTMLFormElement>) => void;
export type TChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => void;

export type TInputProps = {
  onChange: TChangeInput;
  value: string;
  error: boolean;
  label: string;
};

export interface IEventFormProps {
  eventId?: string;
  onCancel?: () => void;
  applyCallback?: () => void;
}

export type TUseEventForm = (
  props: IEventFormProps,
) => {
  isLoading: boolean;
  isDisabled: boolean;
  eventNameProps: TInputProps;
  placeProps: TInputProps;
  dateProps: TInputProps;
  timeProps: TInputProps;
  minimumProps: TInputProps;
  handleSubmit: TEventFormSubmit;
};
