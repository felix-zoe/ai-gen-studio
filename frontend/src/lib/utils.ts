import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Download a file from a (possibly cross-origin) URL.
 * Fetches the resource as a blob and triggers a browser download,
 * working around the fact that `<a download>` is ignored for cross-origin URLs.
 */
export async function downloadFile(url: string, filename?: string) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || url.split("/").pop()?.split("?")[0] || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // fetch 失败（通常是 CORS），降级为新标签页打开
    window.open(url, "_blank");
  }
}

/**
 * Download a generation result (image/video) via backend proxy.
 * Avoids CORS issues by routing through the same-origin API.
 */
export async function downloadGeneration(id: number, type: "image" | "video") {
  const apiBase = import.meta.env.VITE_API_BASE || "/api";
  const token = localStorage.getItem("token");
  const url = `${apiBase}/generations/${id}/download?type=${type}`;

  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`下载失败 (HTTP ${resp.status})`);

  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;

  // Try to extract filename from Content-Disposition header
  const disposition = resp.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?(.+?)"?$/);
  a.download = match?.[1] || `generation-${id}.${type === "video" ? "mp4" : "png"}`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}