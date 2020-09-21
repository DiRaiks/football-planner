import React, { FC } from 'react';
import { useObserver } from 'mobx-react';

import { UserStore } from '../../store';

import $ from './account.module.css';

const Account: FC = () => {
  const userData = useObserver(() => UserStore.user);

  return (
    <div className={$.container}>
      <h3>Личный кабинет</h3>
      <p>Имя: {userData?.name}</p>
      <p>Email: {userData?.email}</p>
    </div>
  );
};

export default Account;
