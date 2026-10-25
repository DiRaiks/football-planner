export interface IEventProps {
  eventName: string;
  place: string;
  time: string;
  date: string;
  playersAmount: number;
  playersMinimum: number;
  isDisabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export type TUseEventActions = () => {
  openEventHandler: (id: string) => void;
  deleteEventHandler: (id: string) => void;
  isPending: boolean;
};
