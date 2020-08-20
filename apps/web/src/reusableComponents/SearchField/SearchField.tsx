import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import cn from 'classnames';

import FormField from '../FormField';
import Input from '../Input';
import IconButton from '../IconButton/IconButton';
import Icon from '../Icon/Icon';

import { ISearchField, TSearchInputRef } from './types';
import styles from './searchField.module.scss';

const DEFAULT_MIN = 2;

const SearchField: ISearchField = (props, ref) => {
  const { className, style, minLength = DEFAULT_MIN, onSearch, onChange, onSearchInput, ...rest } = props;
  const classes = cn(styles.wrapper, className);

  const [disabled, setDisabled] = useState(!props.value);

  // sync refs
  const inputRef = useRef<TSearchInputRef>(null);
  useImperativeHandle<TSearchInputRef, TSearchInputRef>(ref, () => inputRef.current);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;

      setDisabled(!value);
      if (onChange) onChange(event);
      if (onSearchInput) onSearchInput(value.length >= minLength ? value : '');
    },
    [minLength, onChange, onSearchInput],
  );

  const handleSearch = useCallback(() => {
    onSearch && onSearch(inputRef.current?.value || '');
  }, [onSearch]);

  const decorator = onSearch ? (
    <IconButton
      color="gray"
      disabled={disabled}
      size="l"
      type="button"
      variant="ghost"
      className={styles.button}
      onClick={handleSearch}
      icon="search"
    />
  ) : (
    <Icon type="search" className={styles.icon} />
  );

  return (
    <FormField style={style} className={classes} rightDecorator={decorator}>
      <Input ref={inputRef} onChange={handleChange} {...rest} />
    </FormField>
  );
};

export default forwardRef(SearchField);
