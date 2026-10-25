import React, { FC } from 'react';
import { MainContainer } from 'reusableComponents';

import Header from 'components/Header';

const Main: FC = ({ children }) => {
  return (
    <MainContainer>
      <Header />
      {children}
    </MainContainer>
  );
};

export default Main;
