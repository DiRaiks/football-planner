import React, { FC } from 'react';
import { useHistory } from 'react-router-dom';

import { FormTextField, ServicePage, ServiceForm, Button, FormPasswordField } from 'reusableComponents';

import { ROUTE_LOGIN } from 'constantsVars';

import { useRegistrationForm } from './useRegistrationForm';

import styles from './index.module.scss';

const RegistrationForm: FC = props => {
  const history = useHistory();

  const {
    isPending,
    isDisabled,
    isShowSuccessMessage,
    handleSubmit,
    emailProps,
    userNameProps,
    passwordProps,
    repeatPasswordProps,
  } = useRegistrationForm();

  return (
    <ServicePage>
      <ServiceForm method="post" onSubmit={handleSubmit}>
        {isShowSuccessMessage ? (
          <div>
            <h1 className={styles.successHeader}>Успех</h1>
            <div className={styles.success}>Кайф</div>
          </div>
        ) : (
          <>
            <h1>Регистрация</h1>
            <div className={styles.header}>
              <div className={styles.haveAccountWr}>Уже есть аккаунт?</div>
              <div className={styles.signInButton} onClick={(): void => history.push(ROUTE_LOGIN)}>
                <div>Вход</div>
              </div>
            </div>
            <FormTextField autoFocus {...userNameProps} />
            <FormTextField {...emailProps} />
            <FormPasswordField autoFocus autoComplete="new-password" {...passwordProps} />
            <FormTextField autoComplete="new-password" type="password" {...repeatPasswordProps} />
            <Button type="submit" disabled={isDisabled} loading={isPending} size="l" className={styles.signUpButton}>
              Регистрация
            </Button>
          </>
        )}
      </ServiceForm>
    </ServicePage>
  );
};

export default RegistrationForm;
