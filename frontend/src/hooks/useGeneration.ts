import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
) {
  return useQuery({
    queryKey: ["generations", type, page],
    queryFn: () =>
      api
        .get<GenerationListResponse>("/generations", {
          params: { type, page, page_size: pageSize },
        })
        .then((r) => r.data),
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
