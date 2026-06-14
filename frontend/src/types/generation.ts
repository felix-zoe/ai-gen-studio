export interface Generation {
  id: number;
  provider: string;
  type: string;
  mode: string;
  prompt: string;
  size: string;
  image_url?: string | null;
  video_url?: string | null;
  progress?: number | null;
  status: string;
  error?: string | null;
  created_at: string;
  width?: number | null;
  height?: number | null;
  num_frames?: number | null;
  frame_rate?: number | null;
}

export interface GenerationListResponse {
  items: Generation[];
  total: number;
  page: number;
  page_size: number;
}

export interface GenerateImageRequest {
  provider: string;
  mode: string;
  prompt: string;
  size: string;
  image_url?: string;
}

export interface GenerateVideoRequest {
  provider: string;
  mode: string;
  prompt: string;
  image_url?: string;
  width: number;
  height: number;
  num_frames: number;
  frame_rate: number;
}

export interface VideoCreateResponse {
  id: number;
  status: string;
  progress: number;
}

export interface UserInfo {
  id: number;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface KeyStatus {
  provider: string;
  configured: boolean;
  masked_key: string | null;
}

export interface KeysStatusResponse {
  keys: KeyStatus[];
}
