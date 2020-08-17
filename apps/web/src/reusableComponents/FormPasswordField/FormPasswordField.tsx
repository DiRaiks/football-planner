import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';

import FormField from '../FormField';
import Input from '../Input';
import IconButton from '../IconButton';

import { IFormPasswordField, TInputRef } from './types';

import styles from './formPasswordField.module.scss';

const FormPasswordField: IFormPasswordField = (props, ref) => {
  const [visible, setVisible] = useState(false);
  const handleToggle = useCallback(() => {
    setVisible(state => !state);

    const inputNode = inputRef.current;
    setTimeout(() => {
      if (!inputNode) return;
      const position = inputNode.value.length;

      inputNode.focus();
      inputNode.setSelectionRange(position, position);
    });
  }, []);

  // sync refs
  const inputRef = useRef<TInputRef>(null);
  useImperativeHandle<TInputRef, TInputRef>(ref, () => inputRef.current);

  const type = visible ? 'text' : 'password';
  const icon = visible ? 'visibility-on' : 'visibility-off';

  const toggler = (
    <IconButton
      size="l"
      type="button"
      color="gray"
      variant="ghost"
      className={styles.toggler}
      onClick={handleToggle}
      icon={icon}
    />
  );

  return (
    <FormField rightDecorator={toggler}>
      <Input ref={inputRef} {...props} type={type} />
    </FormField>
  );
};

export default forwardRef(FormPasswordField);
