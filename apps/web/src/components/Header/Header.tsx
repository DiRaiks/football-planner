import React from 'react';
import { ContainerSticky } from 'reusableComponents';

import HeaderBreadcrumbs from './HeaderBreadcrumbs';

import $ from './header.module.scss';

const Header: React.FC = () => {
  return (
    <ContainerSticky className={$.container}>
      <div className={$.header}>
        <HeaderBreadcrumbs />
      </div>
    </ContainerSticky>
  );
};

export default Header;
