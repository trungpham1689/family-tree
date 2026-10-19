import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { disableCalendarFeed, getCalendarFeedToken, rotateCalendarFeed } from './calendar-feed';
import { listTreeEvents, loadMyCalendar, removeTreeEvent, saveTreeEvent } from './calendar';

// ---------------------------------------------------------------------------
// Lịch của tôi và Sự kiện
// ---------------------------------------------------------------------------
export const useMyCalendar = (enabled: boolean) => {
  const { state } = useAuth();
  const accountId = state.status === 'signed-in' ? state.session.user.id : '';
  return useQuery({
    queryKey: ['trees', 'calendar', accountId],
    queryFn: () => loadMyCalendar(accountId),
    enabled: enabled && accountId !== '',
  });
};

export const useCalendarFeed = () => {
  const { state } = useAuth();
  const accountId = state.status === 'signed-in' ? state.session.user.id : '';
  return useQuery({ queryKey: ['calendar-feed', accountId], queryFn: getCalendarFeedToken, enabled: accountId !== '' });
};

const useCalendarFeedMutation = <Variables>(mutationFn: (variables: Variables) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-feed'] }) });
};
export const useRotateCalendarFeed = () => useCalendarFeedMutation(rotateCalendarFeed);
export const useDisableCalendarFeed = () => useCalendarFeedMutation(disableCalendarFeed);

export const useTreeEvents = (treeId: string) =>
  useQuery({ queryKey: ['trees', treeId, 'events'], queryFn: () => listTreeEvents(treeId) });

const useEventMutation = <Input,>(treeId: string, mutationFn: (input: Input) => Promise<void>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trees', treeId, 'events'] }),
        queryClient.invalidateQueries({ queryKey: ['trees', 'calendar'] }),
      ]),
  });
};

export const useSaveTreeEvent = (treeId: string) => useEventMutation(treeId, saveTreeEvent);
export const useRemoveTreeEvent = (treeId: string) => useEventMutation(treeId, removeTreeEvent);
