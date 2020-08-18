import React, { FC } from 'react';
import { Route, Switch } from 'react-router-dom';
import { NoMatch } from 'components/NoMatch';
import { ROUTE_EVENTS } from 'constantsVars';

import EventsList from './EventsList';

const Events: FC = () => (
  <>
    <Switch>
      <Route path={`${ROUTE_EVENTS}/:status(all|active|blocked|deleted)?`} exact component={EventsList} />
      <Route path={`${ROUTE_EVENTS}/:eventId`} component={EventsList} />
      <Route component={NoMatch} />
    </Switch>
  </>
);

export default Events;
