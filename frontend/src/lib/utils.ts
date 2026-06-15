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
  const resp = await fetch(url);
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || url.split("/").pop()?.split("?")[0] || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}