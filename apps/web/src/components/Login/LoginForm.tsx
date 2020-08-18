import React from 'react';
import { useHistory } from 'react-router-dom';

import { ServicePage, ServiceForm, FormTextField, FormPasswordField, Button } from 'reusableComponents';

import { ROUTE_REGISTRATION } from 'constantsVars';

import { useLoginForm } from './useLoginForm';
import styles from './login.module.scss';

export const SignInForm: React.FC = () => {
  const history = useHistory();

  const { isLoading, isDisabled, userNameProps, passwordProps, handleSubmit } = useLoginForm();

  return (
    <ServicePage>
      <ServiceForm method="post" onSubmit={handleSubmit}>
        <h1>Вход</h1>
        <FormTextField autoFocus autoComplete="username" {...userNameProps} />
        <FormPasswordField autoComplete="current-password" {...passwordProps} />
        <div className={styles.footer}>
          <Button type="submit" disabled={isDisabled} loading={isLoading} size="l" className={styles.signInButton}>
            Войти
          </Button>
          <div className={styles.header}>
            <div className={styles.noAccountWr}>Ещё нет аккаунта?</div>
          </div>
          <div className={styles.signUpButton} onClick={(): void => history.push(ROUTE_REGISTRATION)}>
            <div>Регистрация</div>
          </div>
          {/*<Link to={ROUTE_PASSWORD_RESET} className={styles.forgotPassword}>*/}
          {/*  Забыли пароль?*/}
          {/*</Link>*/}
        </div>
      </ServiceForm>
    </ServicePage>
  );
};

export default SignInForm;
