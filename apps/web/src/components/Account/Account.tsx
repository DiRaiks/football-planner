import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { UserStore } from 'store';

import styles from './account.module.css';

const Account: FC = () => {
  const userData = useObserver(() => UserStore.user);
  const eventsCount = useObserver(() => UserStore.userEventsCount);

  return (
    <div className={styles.container}>
      <h3>Личный кабинет</h3>
      <p>Имя: {userData?.name}</p>
      <p>Email: {userData?.email}</p>
      <p>Сыграно матчей: {eventsCount}</p>
    </div>
  );
};

export default Account;
