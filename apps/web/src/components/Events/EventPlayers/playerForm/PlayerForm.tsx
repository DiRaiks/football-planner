import React, { FC } from 'react';

import { ServiceForm, Button, Input, Chip, ChipGroup } from 'reusableComponents';

import { usePlayerForm } from './usePlayerForm';
import { IPlayerFormProps } from './types';
import styles from './playerForm.module.scss';

export const PlayerForm: FC<IPlayerFormProps> = props => {
  const {
    isLoading,
    isDisabled,
    isFriendDisabled,
    handleSubmit,
    deleteFriend,
    addFriend,
    nameProps,
    friendProps,
    friends,
  } = usePlayerForm(props);

  return (
    <ServiceForm method="post" onSubmit={handleSubmit} className={styles.form}>
      <Input className={styles.input} autoFocus autoComplete="name" {...nameProps} />
      <ChipGroup className={styles.friends}>
        {friends?.map((friend, index) => (
          <Chip key={index} onDelete={(): void => deleteFriend(friend.name)}>
            {friend.name}
          </Chip>
        ))}
      </ChipGroup>
      <Input className={styles.input} autoComplete="friend" {...friendProps} />
      <Button disabled={isFriendDisabled} size="m" className={styles.addFriendButton} onClick={addFriend}>
        Добавить друга
      </Button>
      <Button type="submit" disabled={isDisabled} loading={isLoading} size="m" className={styles.createButton}>
        Применить
      </Button>
    </ServiceForm>
  );
};

export default PlayerForm;
