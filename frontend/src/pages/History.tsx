import { useState } from "react";
import {
  Image,
  Video,
  Clock,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useGenerations } from "@/hooks/useGeneration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Generation } from "@/types/generation";

function formatDuration(frames: number | null, fps: number | null): string {
  if (!frames || !fps) return "";
  return `${(frames / fps).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  const label =
    status === "queued"
      ? "排队中"
      : status === "in_progress"
        ? "生成中"
        : status === "completed"
          ? "已完成"
          : status === "failed"
            ? "失败"
            : status;
  return <Badge variant={variant}>{label}</Badge>;
}

export default function History() {
  const [tab, setTab] = useState("image");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<Generation | null>(null);

  const { data, isLoading, isError } = useGenerations(tab, page);

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">历史记录</h1>
        <p className="text-muted-foreground">
          查看已生成的图片和视频
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            图片
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            视频
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
          加载失败，请稍后重试
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <p>暂无 {tab === "image" ? "图片" : "视频"} 记录</p>
        </div>
      )}

      {/* Grid */}
      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((gen) => (
            <Card
              key={gen.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => setPreview(gen)}
            >
              {tab === "image" ? (
                gen.image_url ? (
                  <div className="aspect-square overflow-hidden rounded-t-lg">
                    <img
                      src={gen.image_url}
                      alt={gen.prompt}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-t-lg bg-muted">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )
              ) : gen.video_url ? (
                <div className="aspect-video overflow-hidden rounded-t-lg bg-black">
                  <video
                    src={gen.video_url}
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-t-lg bg-muted">
                  <Video className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={gen.status} />
                  {tab === "video" && gen.num_frames && gen.frame_rate && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(gen.num_frames, gen.frame_rate)}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {gen.prompt}
                </p>
                {gen.status === "in_progress" && gen.progress != null && (
                  <Progress value={gen.progress} className="mt-2 h-1" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={preview !== null} onOpenChange={() => setPreview(null)}>
        {preview && (
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">预览</DialogTitle>
            <DialogDescription className="sr-only">
              {preview.prompt}
            </DialogDescription>
            {preview.type === "video" && preview.video_url ? (
              <video
                src={preview.video_url}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            ) : preview.image_url ? (
              <img
                src={preview.image_url}
                alt={preview.prompt}
                className="w-full rounded-lg"
              />
            ) : null}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {preview.prompt}
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge status={preview.status} />
                <span className="text-xs text-muted-foreground">
                  {preview.provider} · {preview.size}
                  {preview.num_frames && ` · ${preview.num_frames}f`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      preview.video_url || preview.image_url || undefined,
                      "_blank",
                    )
                  }
                  disabled={!preview.video_url && !preview.image_url}
                >
                  <ExternalLink className="h-4 w-4" />
                  查看原图
                </Button>
                {preview.type === "video" && preview.video_url && (
                  <a href={preview.video_url} download>
                    <Button size="sm">
                      <Download className="h-4 w-4" />
                      下载
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}