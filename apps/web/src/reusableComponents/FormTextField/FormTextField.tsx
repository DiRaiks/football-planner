import React, { forwardRef } from 'react';

import FormField from '../FormField';
import Input from '../Input';

import { IFormTextField } from './types';

const FormTextField: IFormTextField = (props, ref) => (
  <FormField>
    <Input ref={ref} {...props} />
  </FormField>
);

export default forwardRef(FormTextField);
