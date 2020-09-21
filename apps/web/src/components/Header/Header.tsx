import React from 'react';
import { useObserver } from 'mobx-react';
import { Link, useLocation } from 'react-router-dom';

import { UserStore } from 'store';
import { ROUTE_EVENTS } from 'constantsVars';
import { ContainerSticky } from 'reusableComponents';

import Logo from 'components/Logo';

import HeaderBreadcrumbs from './HeaderBreadcrumbs';

import $ from './header.module.scss';

const Header: React.FC = () => {
  const { pathname } = useLocation();
  const userName = useObserver(() => UserStore.user?.name);
  const eventsCount = useObserver(() => UserStore.userEventsCount);

  const onLogoClick = (event: React.MouseEvent): void => {
    if (pathname === ROUTE_EVENTS) event.preventDefault();
  };

  return (
    <ContainerSticky className={$.container}>
      <div className={$.header}>
        <Link to="/" className={$.logoLink} onClick={onLogoClick}>
          <Logo />
        </Link>
        <HeaderBreadcrumbs />
        <div className={$.userInfo}>
          <Link to="/account" className={$.name}>
            {userName}
          </Link>
          <div>
            Сыгранно матчей: <span className={$.count}>{eventsCount}</span>
          </div>
        </div>
      </div>
    </ContainerSticky>
  );
};

export default Header;
