import React from 'react';
import { useObserver } from 'mobx-react';
import { ContainerSticky } from 'reusableComponents';
import Logo from 'components/Logo';
import { UserStore } from 'store';

import HeaderBreadcrumbs from './HeaderBreadcrumbs';

import $ from './header.module.scss';

const Header: React.FC = () => {
  const userName = useObserver(() => UserStore.user?.name);
  const eventsCount = useObserver(() => UserStore.userEventsCount);

  return (
    <ContainerSticky className={$.container}>
      <div className={$.header}>
        <Logo />
        <HeaderBreadcrumbs />
        <div className={$.userInfo}>
          <div className={$.name}>{userName}</div>
          <div>
            Сыгранно матчей: <span className={$.count}>{eventsCount}</span>
          </div>
        </div>
      </div>
    </ContainerSticky>
  );
};

export default Header;
