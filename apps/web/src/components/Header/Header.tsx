import React from 'react';
import { ContainerSticky } from 'reusableComponents';
import Logo from 'components/Logo';

import HeaderBreadcrumbs from './HeaderBreadcrumbs';

import $ from './header.module.scss';

const Header: React.FC = () => {
  return (
    <ContainerSticky className={$.container}>
      <div className={$.header}>
        <Logo />
        <HeaderBreadcrumbs />
      </div>
    </ContainerSticky>
  );
};

export default Header;
