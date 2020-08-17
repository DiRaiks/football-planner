import { observable, action } from 'mobx';
import uniqueId from 'lodash/uniqueId';

import { IAlert, TAlertsList, TMessageType } from './types.d';

class AlertsStore {
  @observable alerts: TAlertsList = [];

  @action addAlert(meta: Omit<IAlert, 'alertId'>): string {
    const alertId = `alert-${uniqueId()}`;
    this.alerts = [...this.alerts, { ...meta, alertId }];

    return alertId;
  }

  @action removeAlert(alertId: string): void {
    this.alerts = this.alerts.filter(meta => meta.alertId !== alertId);
  }

  showInfo(message: string): void {
    this.addAlert({ message, type: 'info' });
  }

  showError(message: string): void {
    this.addAlert({ message, type: 'error' });
  }

  showWarning(message: string): void {
    this.addAlert({ message, type: 'warning' });
  }

  showTempAlert(message: string, type: TMessageType, duration = 5000): void {
    const alertId = this.addAlert({ message, type, isTemp: true });

    setTimeout(() => {
      this.removeAlert(alertId);
    }, duration);
  }
}

export default new AlertsStore();
