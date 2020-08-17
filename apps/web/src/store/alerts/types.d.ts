export type TAlertsList = IAlert[];

export type TMessageType = 'error' | 'info' | 'warning';

export interface IAlert {
  alertId: string;
  type: TMessageType;
  message: string;
  isTemp?: boolean;
}
