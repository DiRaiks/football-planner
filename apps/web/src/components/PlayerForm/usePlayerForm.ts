import { useCallback, useEffect, useState } from 'react';
import { useObserver } from 'mobx-react';

import { UserStore, PlayerStore, IFriendModel, PlayersStore, EventStore } from 'store';
import { useTextField, useInputProps } from 'hooks';

import { TPlayerForm, TEventFormSubmit } from './types';

export const usePlayerForm: TPlayerForm = props => {
  const { eventId } = props;
  const [friends, setFriends] = useState<IFriendModel[]>([]);
  const [playerStatus, setPlayerStatus] = useState<boolean>(false);
  const [friendStatus, setFriendStatus] = useState<boolean>(false);
  const [isShowForm, setIsShowForm] = useState(false);
  const isChangePlayerPending = useObserver(() => PlayerStore.changePlayerAction.isPending);
  const isDeletePlayerPending = useObserver(() => PlayerStore.deletePlayerAction.isPending);
  const player = useObserver(() => PlayerStore.entity);
  const isPlayerLoading = useObserver(() => PlayerStore.isPending);

  useEffect(() => {
    PlayerStore.updatePlayer(eventId);
  }, [eventId]);

  useEffect(() => {
    if (player) {
      setFriends(player.friends);
      setPlayerStatus(player.status);
    }
  }, [player]);

  const { value: nameValue, changeValue: changeNameValue } = useTextField();
  const nameProps = useInputProps({
    value: nameValue || (player ? player.name : UserStore.user?.name || ''),
    changeValue: changeNameValue,
    localError: null,
    serverError: null,
    label: 'Ваше имя',
  });

  const friend = useTextField();
  const friendProps = useInputProps({
    ...friend,
    localError: null,
    serverError: null,
    label: 'Имя друга',
  });

  const isDisabled = !nameProps.value;
  const isFriendDisabled = !friendProps.value;

  const handleSubmit: TEventFormSubmit = useCallback(
    async event => {
      event.preventDefault();
      const newPlayer = { name: nameProps.value, friends, status: playerStatus };
      let action = PlayerStore.changePlayer.bind(PlayerStore);

      if (!player) action = PlayerStore.addPlayer.bind(PlayerStore);

      const result = await action(newPlayer);
      if (result) {
        PlayersStore.updateEntities();
        EventStore.updateEvent(eventId);
        setIsShowForm(false);
      }
    },
    [eventId, friends, nameProps.value, player, playerStatus],
  );

  const deleteFriend = useCallback((friendName: string) => {
    setFriends(friends => {
      return [...friends.filter(friend => friend.name !== friendName)];
    });
  }, []);

  const addFriend = useCallback(() => {
    setFriends(friends => {
      return [...friends, { name: friendProps.value, status: friendStatus }];
    });
    friend.resetValue();
    setFriendStatus(false);
  }, [friend, friendProps.value, friendStatus]);

  const deletePlayer = useCallback(async () => {
    const result = await PlayerStore.deletePlayer(player?._id || '');
    if (result) {
      PlayersStore.updateEntities();
      EventStore.updateEvent(eventId);
      PlayerStore.resetEntity();
      setFriends([]);
    }
  }, [eventId, player]);

  const changePlayerStatus = useCallback((status: boolean) => {
    setPlayerStatus(status);
  }, []);

  const changeFriendStatus = useCallback((status: boolean) => {
    setFriendStatus(status);
  }, []);

  useEffect(() => {
    return (): void => {
      setFriends([]);
      PlayerStore.resetEntity();
    };
  }, []);

  const isLoading = isChangePlayerPending;

  return {
    isLoading,
    isDisabled,
    isFriendDisabled,
    isDeletePlayerPending,
    isPlayerLoading,
    playerStatus,
    friendStatus,
    nameProps,
    friendProps,
    handleSubmit,
    deleteFriend,
    addFriend,
    friends,
    isShowForm,
    setIsShowForm,
    player,
    deletePlayer,
    changePlayerStatus,
    changeFriendStatus,
  };
};
