import { hot } from 'react-hot-loader/root';
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';

import Login from 'components/Login';

import './App.scss';

export const App: React.FC = () => {
  const isAuthenticated = false;

  return (
    <Router>
      {isAuthenticated ? (
        <>
          <Suspense fallback={<div />}></Suspense>
        </>
      ) : (
        <Switch>
          <Route path="*" component={Login} />
        </Switch>
      )}
    </Router>
  );
};

export default process.env.NODE_ENV === 'development' ? hot(App) : App;
