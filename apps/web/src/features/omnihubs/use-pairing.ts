import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { omnihubsKeys } from "./use-omnihubs";

export interface PendingPairing {
  pairingCode: string;
  deviceId: string;
  waitingSeconds: number;
}

export interface PairInput {
  pairingCode: string;
  name?: string;
  storeId?: string;
}

export const pairingKeys = {
  pending: ["omnihubs", "pending"] as const,
};

export function usePendingPairings(refetchIntervalMs = 3000) {
  return useQuery({
    queryKey: pairingKeys.pending,
    queryFn: async () => {
      const { data } = await api.get<PendingPairing[]>("/omnihubs/pending");
      return data;
    },
    refetchInterval: refetchIntervalMs,
  });
}

export function useClaimPairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PairInput) => {
      const { data } = await api.post("/omnihubs/pair", input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: omnihubsKeys.all });
      qc.invalidateQueries({ queryKey: pairingKeys.pending });
    },
  });
}
