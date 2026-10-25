import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useObserver } from 'mobx-react';

import { EventsStore } from 'store';
import { ROUTE_EVENTS } from 'constantsVars';

import { TUseEventActions } from './types';

export const useEventActions: TUseEventActions = () => {
  const history = useHistory();

  const deletePending = useObserver(() => EventsStore.deleteEventAction.isPending);

  const openEventHandler = useCallback(
    (id: string) => {
      history.push(`${ROUTE_EVENTS}/${id}`);
    },
    [history],
  );

  const deleteEventHandler = useCallback((id: string) => {
    EventsStore.deleteEvent(id);
  }, []);

  const isPending = deletePending;

  return {
    openEventHandler,
    deleteEventHandler,
    isPending,
  };
};
