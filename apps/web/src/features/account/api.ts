import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordBody,
  Session,
  UpdateMeBody,
  User,
  UserStats,
} from '@football-planner/shared';

import { api } from '@/lib/api';
import { meKey, useAuth } from '@/features/auth/auth';

export const useUserStats = (userId: string) =>
  useQuery({
    queryKey: ['users', userId, 'stats'],
    queryFn: () => api<UserStats>('GET', `/users/${userId}/stats`),
  });

export const useUpdateMe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeBody) => api<User>('PATCH', '/users/me', body),
    onSuccess: (user) => queryClient.setQueryData(meKey, user),
  });
};

export const useChangePassword = () => {
  const { setSession } = useAuth();
  return useMutation({
    mutationFn: (body: ChangePasswordBody) =>
      api<Session>('POST', '/users/me/password', body),
    // Older tokens are revoked; keep this device signed in with the new one
    onSuccess: setSession,
  });
};
