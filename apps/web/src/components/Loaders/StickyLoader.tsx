import React, { FC } from 'react';
import { Loader, ContainerSticky } from 'reusableComponents';

import styles from './stickyLoader.module.scss';

const StickyLoader: FC = () => {
  return (
    <div className={styles.wrapper}>
      <ContainerSticky className={styles.sticky}>
        <Loader className={styles.loader} color="main" />
      </ContainerSticky>
    </div>
  );
};

export default StickyLoader;
