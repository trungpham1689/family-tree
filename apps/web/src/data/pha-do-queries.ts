import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadPhaDoConfig, savePhaDoConfig } from './pha-do';

// ---------------------------------------------------------------------------
// Phả đồ
// ---------------------------------------------------------------------------
export const usePhaDoConfig = (treeId: string) =>
  useQuery({ queryKey: ['trees', treeId, 'pha-do'], queryFn: () => loadPhaDoConfig(treeId) });

export const useSavePhaDoConfig = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePhaDoConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trees', treeId, 'pha-do'] }),
  });
};
