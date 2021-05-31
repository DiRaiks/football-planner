import React, { FC } from 'react';

import { ServiceForm, Button, Chip, ChipGroup, IconButton } from 'reusableComponents';
import PlayerInput from 'components/PlayerInput';

import { usePlayerForm } from './usePlayerForm';
import { IPlayerFormProps } from './types';
import styles from './playerForm.module.scss';

export const PlayerForm: FC<IPlayerFormProps> = props => {
  const {
    isLoading,
    isDisabled,
    isFriendDisabled,
    isDeletePlayerPending,
    isPlayerLoading,
    playerStatus,
    friendStatus,
    handleSubmit,
    deleteFriend,
    addFriend,
    nameProps,
    friendProps,
    friends,
    isShowForm,
    setIsShowForm,
    player,
    deletePlayer,
    changePlayerStatus,
    changeFriendStatus,
  } = usePlayerForm(props);

  console.log('----isPlayerLoading', isPlayerLoading);

  if (isPlayerLoading) return null;

  if (!isShowForm) {
    return (
      <div className={styles.settingsWr}>
        <Button className={styles.assignButton} onClick={(): void => setIsShowForm(true)}>
          {player ? 'Изменить решение' : 'Принять участие'}
        </Button>
        {player && (
          <Button onClick={deletePlayer} loading={isDeletePlayerPending}>
            Удалить запись
          </Button>
        )}
      </div>
    );
  }

  return (
    <ServiceForm method="post" onSubmit={handleSubmit} className={styles.form}>
      <IconButton
        data-tooltip="Отмена"
        className={styles.closeIcon}
        variant="ghost"
        icon="close"
        onClick={(): void => setIsShowForm(false)}
      />
      <PlayerInput
        autoFocus
        autoComplete="name"
        status={playerStatus}
        onStatusChange={changePlayerStatus}
        {...nameProps}
      />
      <ChipGroup className={styles.friends}>
        {friends?.map((friend, index) => (
          <Chip
            className={friend.status ? styles.friendTrue : styles.friendMaybe}
            key={index}
            onDelete={(): void => deleteFriend(friend.name)}
          >
            {friend.name}
          </Chip>
        ))}
      </ChipGroup>
      <PlayerInput autoComplete="friend" status={friendStatus} onStatusChange={changeFriendStatus} {...friendProps} />
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
