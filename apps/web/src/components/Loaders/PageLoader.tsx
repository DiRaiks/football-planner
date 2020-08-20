import React, { FC } from 'react';
import { Loader, ContainerSticky } from 'reusableComponents';

import styles from './pageLoader.module.scss';

const PageLoader: FC = () => (
  <div className={styles.wrapper}>
    <ContainerSticky className={styles.sticky}>
      <Loader className={styles.loader} color="main" />
    </ContainerSticky>
  </div>
);

export default PageLoader;
