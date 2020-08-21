import { useCallback, useEffect, useState } from 'react';
import { useObserver } from 'mobx-react';

import { UserStore, PlayerStore, IFriendModel, PlayersStore, EventStore } from 'store';
import { useTextField, useInputProps } from 'hooks';

import { TEventForm, TEventFormSubmit } from './types';

export const usePlayerForm: TEventForm = props => {
  const { eventId } = props;
  const [friends, setFriends] = useState<IFriendModel[]>([]);
  const [isShowForm, setIsShowForm] = useState(false);
  const isChangePlayerPending = useObserver(() => PlayerStore.changePlayerAction.isPending);
  const isDeletePlayerPending = useObserver(() => PlayerStore.deletePlayerAction.isPending);
  const player = useObserver(() => PlayerStore.entity);

  useEffect(() => {
    PlayerStore.updatePlayer(eventId);
  }, [eventId]);

  useEffect(() => {
    if (player?.friends) setFriends(player.friends);
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
      const newPlayer = { name: nameProps.value, friends, status: true };
      let action = PlayerStore.changePlayer.bind(PlayerStore);

      if (!player) action = PlayerStore.addPlayer.bind(PlayerStore);

      const result = await action(newPlayer);
      if (result) {
        PlayersStore.updateEntities();
        EventStore.updateEvent(eventId);
        setIsShowForm(false);
      }
    },
    [eventId, friends, nameProps.value, player],
  );

  const deleteFriend = useCallback((friendName: string) => {
    setFriends(friends => {
      return [...friends.filter(friend => friend.name !== friendName)];
    });
  }, []);

  const addFriend = useCallback(() => {
    setFriends(friends => {
      return [...friends, { name: friendProps.value, status: true }];
    });
    friend.resetValue();
  }, [friend, friendProps.value]);

  const deletePlayer = useCallback(async () => {
    const result = await PlayerStore.deletePlayer(player?._id || '');
    if (result) {
      PlayersStore.updateEntities();
      EventStore.updateEvent(eventId);
      PlayerStore.resetEntity();
    }
  }, [eventId, player]);

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
  };
};
