import { useQuery } from '@tanstack/react-query';
import type { AttendanceRow } from '@football-planner/shared';

import { api } from '@/lib/api';

export const useAttendance = (days: number) =>
  useQuery({
    queryKey: ['stats', 'attendance', days] as const,
    queryFn: () =>
      api<AttendanceRow[]>('GET', `/stats/attendance?days=${days}`),
  });
