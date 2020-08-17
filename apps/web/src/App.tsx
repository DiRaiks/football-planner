import { hot } from 'react-hot-loader/root';
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Switch } from 'react-router-dom';

import './App.scss';

export const App: React.FC = () => {
  const isAuthenticated = true;

  return (
    <Router>
      {isAuthenticated ? (
        <>
          <Suspense fallback={<div />}></Suspense>
        </>
      ) : (
        <Switch></Switch>
      )}
    </Router>
  );
};

export default process.env.NODE_ENV === 'development' ? hot(App) : App;
