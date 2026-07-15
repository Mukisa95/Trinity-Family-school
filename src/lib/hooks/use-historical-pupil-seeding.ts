import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pupilsKeys } from './use-pupils';
import {
  HistoricalPupilSeedingService,
  type HistoricalPupilSeedInput,
} from '@/lib/services/historical-pupil-seeding.service';

export const historicalPupilSeedingKeys = {
  all: ['historicalPupilSeeds'] as const,
};

export function useHistoricalPupilSeeds() {
  return useQuery({
    queryKey: historicalPupilSeedingKeys.all,
    queryFn: () => HistoricalPupilSeedingService.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateHistoricalPupilSeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: HistoricalPupilSeedInput) => HistoricalPupilSeedingService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historicalPupilSeedingKeys.all });
      queryClient.invalidateQueries({ queryKey: pupilsKeys.all });
    },
  });
}
