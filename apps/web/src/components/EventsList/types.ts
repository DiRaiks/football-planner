export interface IEventProps {
  eventName: string;
  place: string;
  time: string;
  date: string;
  playersAmount: number;
  playersMinimum: number;
  isDisabled?: boolean;
}
