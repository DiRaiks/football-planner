import React from 'react';
import { useObserver } from 'mobx-react';
import { Link } from 'react-router-dom';

import { UserStore } from 'store';
import { ContainerSticky } from 'reusableComponents';

import Logo from 'components/Logo';

import HeaderBreadcrumbs from './HeaderBreadcrumbs';

import $ from './header.module.scss';

const Header: React.FC = () => {
  const userName = useObserver(() => UserStore.user?.name);
  const eventsCount = useObserver(() => UserStore.userEventsCount);

  return (
    <ContainerSticky className={$.container}>
      <div className={$.header}>
        <Link to="/events" className={$.logoLink}>
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
