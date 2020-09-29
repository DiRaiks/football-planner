import React from 'react';
import { useObserver } from 'mobx-react';
import { Link } from 'react-router-dom';

import { UserStore } from 'store';
import { ContainerSticky } from 'reusableComponents';

import Logo from 'components/Logo';

import HeaderBreadcrumbs from './HeaderBreadcrumbs';

import styles from './header.module.scss';

const Header: React.FC = () => {
  const userName = useObserver(() => UserStore.user?.name);
  const eventsCount = useObserver(() => UserStore.userEventsCount);

  return (
    <ContainerSticky className={styles.container}>
      <div className={styles.header}>
        <Link to="/events" className={styles.logoLink}>
          <Logo />
        </Link>
        <HeaderBreadcrumbs />
        <div className={styles.userInfo}>
          <Link to="/account" className={styles.name}>
            {userName}
          </Link>
          <div>
            Сыгранно матчей: <span className={styles.count}>{eventsCount}</span>
          </div>
        </div>
      </div>
    </ContainerSticky>
  );
};

export default Header;
