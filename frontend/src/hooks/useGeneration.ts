import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  Generation,
  GenerationListResponse,
  GenerateImageRequest,
  GenerateVideoRequest,
  VideoCreateResponse,
} from "@/types/generation";

// ── Image generation ──────────────────────────────────────────────────────

export function useGenerateImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateImageRequest) =>
      api.post<Generation>("/generate/image", body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}

// ── Video generation ──────────────────────────────────────────────────────

export function useGenerateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateVideoRequest) =>
      api.post<VideoCreateResponse>("/generate/video", body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}

// ── Single video polling ──────────────────────────────────────────────────

export function useVideoGeneration(id: number | null) {
  return useQuery({
    queryKey: ["generations", id],
    queryFn: () =>
      api.get<Generation>(`/generations/${id}`).then((r) => r.data),
    enabled: id !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (data.status === "queued" || data.status === "in_progress") return 3000;
      return false;
    },
    staleTime: 0,
  });
}

// ── List generations ──────────────────────────────────────────────────────

export function useGenerations(
  type: string = "image",
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  statusFilter?: string,
  modeFilter?: string,
) {
  return useQuery({
    queryKey: ["generations", type, page, search, statusFilter, modeFilter],
    queryFn: () =>
      api
        .get<GenerationListResponse>("/generations", {
          params: {
            type,
            page,
            page_size: pageSize,
            ...(search ? { search } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(modeFilter ? { mode: modeFilter } : {}),
          },
        })
        .then((r) => r.data),
    // List does NOT poll — individual active items are polled via usePollActiveItems
    placeholderData: keepPreviousData,
  });
}

// ── Poll active (in-progress/queued) items ────────────────────────────────

/**
 * Polls each active generation ID individually every 5 seconds.
 * When any item reaches terminal state (completed/failed), invalidates the
 * generations list cache so the list refreshes once — without continuous
 * full-list polling that causes flicker.
 */
export function usePollActiveItems(ids: number[]) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["generations-poll", ids],
    queryFn: async () => {
      const settled = await Promise.allSettled(
        ids.map((id) =>
          api.get<Generation>(`/generations/${id}`).then((r) => r.data)
        )
      );
      // Collect only fulfilled results; rejected polls are silently skipped
      const results = settled
        .filter(
          (r): r is PromiseFulfilledResult<Generation> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);

      // Check if any item reached terminal state — trigger one list refresh
      const hasTerminal = results.some(
        (r) => r.status === "completed" || r.status === "failed"
      );
      if (hasTerminal) {
        queryClient.invalidateQueries({ queryKey: ["generations"] });
      }
      return results;
    },
    enabled: ids.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.length === 0) return 5000;
      const allTerminal = data.every(
        (r) => r.status === "completed" || r.status === "failed"
      );
      return allTerminal ? false : 5000;
    },
  });
}

export function useDeleteGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/generations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}

// ── Batch delete ──────────────────────────────────────────────────────────

export function useBatchDeleteGenerations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ deleted: number; not_found: number }>("/generations/batch-delete", { ids }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}

// ── Upload image ──────────────────────────────────────────────────────────

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api
        .post<{ cos_key: string; url: string }>("/upload", formData)
        .then((r) => r.data);
    },
  });
}
