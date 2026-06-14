import { useState } from "react";
import {
  Image,
  Video,
  Clock,
  Download,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { useGenerations, useDeleteGeneration } from "@/hooks/useGeneration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Generation } from "@/types/generation";

// ── Helpers ──────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  text2img: "文生图",
  img2img: "图生图",
  text2vid: "文生视频",
  img2vid: "图生视频",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  in_progress: "生成中",
  completed: "已完成",
  failed: "失败",
};

function getModelName(gen: Generation): string {
  if (gen.type === "video") return "agnes-video-v2.0";
  if (gen.provider === "sensenova") return "sensenova-u1-fast";
  return "agnes-image-2.1-flash";
}

function formatDuration(frames: number | null, fps: number | null): string {
  if (!frames || !fps) return "-";
  return `${(frames / fps).toFixed(1)}s`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncatePrompt(text: string, max = 60): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{STATUS_LABELS[status] || status}</Badge>;
}

// ── Component ────────────────────────────────────────────────────────────

export default function History() {
  const [tab, setTab] = useState("image");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<Generation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Generation | null>(null);

  const { data, isLoading, isError } = useGenerations(tab, page);
  const deleteMutation = useDeleteGeneration();

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">历史记录</h1>
        <p className="text-muted-foreground">
          查看已生成的图片和视频
        </p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
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

      {/* ── Loading ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {isError && (
        <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
          加载失败，请稍后重试
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────── */}
      {data && data.items.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <p>暂无 {tab === "image" ? "图片" : "视频"} 记录</p>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────── */}
      {data && data.items.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>提示词</TableHead>

                {tab === "image" ? (
                  <>
                    <TableHead className="w-[90px]">尺寸</TableHead>
                    <TableHead className="w-[90px]">模型</TableHead>
                    <TableHead className="w-[80px]">模式</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="w-[70px]">时长</TableHead>
                    <TableHead className="w-[90px]">尺寸</TableHead>
                    <TableHead className="w-[90px]">模型</TableHead>
                  </>
                )}

                <TableHead className="w-[80px]">状态</TableHead>
                <TableHead className="w-[130px]">创建时间</TableHead>
                <TableHead className="w-[110px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((gen) => (
                <TableRow key={gen.id}>
                  {/* ID */}
                  <TableCell className="font-mono text-xs">
                    #{gen.id}
                  </TableCell>

                  {/* Prompt */}
                  <TableCell
                    className="max-w-[200px] truncate"
                    title={gen.prompt}
                  >
                    {truncatePrompt(gen.prompt)}
                  </TableCell>

                  {/* Type-specific columns */}
                  {tab === "image" ? (
                    <>
                      <TableCell className="text-xs">{gen.size}</TableCell>
                      <TableCell className="text-xs font-mono text-[11px]">
                        {getModelName(gen)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {MODE_LABELS[gen.mode] || gen.mode}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(gen.num_frames, gen.frame_rate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{gen.size}</TableCell>
                      <TableCell className="text-xs font-mono text-[11px]">
                        {getModelName(gen)}
                      </TableCell>
                    </>
                  )}

                  {/* Status */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={gen.status} />
                      {tab === "video" && gen.status === "in_progress" && gen.progress != null && (
                        <Progress value={gen.progress} className="h-1" />
                      )}
                    </div>
                  </TableCell>

                  {/* Created At */}
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTime(gen.created_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="预览"
                        onClick={() => setPreview(gen)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {(gen.image_url || gen.video_url) && (
                        <a
                          href={gen.video_url || gen.image_url!}
                          download
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="下载"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => setDeleteTarget(gen)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              共 {data.total} 条
            </p>
            <div className="flex items-center gap-2">
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
          </div>
        </div>
      )}

      {/* ── Preview Dialog ─────────────────────────────────────────── */}
      <Dialog open={preview !== null} onOpenChange={() => setPreview(null)}>
        {preview && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="pr-8 line-clamp-2 text-base">
                {preview.prompt}
              </DialogTitle>
            </DialogHeader>

            {/* Media */}
            <div className="flex items-center justify-center rounded-lg bg-muted min-h-[200px] overflow-hidden">
              {preview.type === "video" && preview.video_url ? (
                <video
                  src={preview.video_url}
                  controls
                  autoPlay
                  className="max-h-[45vh] w-full object-contain"
                />
              ) : preview.image_url ? (
                <img
                  src={preview.image_url}
                  alt={preview.prompt}
                  className="max-h-[45vh] w-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  <Image className="h-8 w-8" />
                  <span className="ml-2">暂无预览</span>
                </div>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">状态</p>
                <div className="mt-0.5">
                  <StatusBadge status={preview.status} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">模型</p>
                <p className="font-medium font-mono text-xs mt-0.5">
                  {getModelName(preview)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">模式</p>
                <p className="font-medium">
                  {MODE_LABELS[preview.mode] || preview.mode}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">尺寸</p>
                <p className="font-medium">{preview.size}</p>
              </div>
              {preview.type === "video" && (
                <div>
                  <p className="text-muted-foreground text-xs">时长</p>
                  <p className="font-medium">
                    {formatDuration(preview.num_frames, preview.frame_rate)}
                    {preview.num_frames && `（${preview.num_frames}f）`}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">创建时间</p>
                <p className="font-medium">
                  {formatDateTime(preview.created_at)}
                </p>
              </div>
              {preview.progress != null && preview.status === "in_progress" && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">生成进度</p>
                  <Progress value={preview.progress} className="mt-1 h-2" />
                </div>
              )}
              {preview.error && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">错误信息</p>
                  <p className="text-sm text-destructive mt-0.5 break-words">
                    {preview.error}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            {(preview.image_url || preview.video_url) && (
              <a
                href={preview.video_url || preview.image_url!}
                download
              >
                <Button className="w-full" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  下载
                </Button>
              </a>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              <p>确定要删除这条记录吗？此操作不可撤销。</p>
              <div className="mt-3 rounded-md bg-muted p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium">ID：</span>
                  <span className="font-mono">#{deleteTarget.id}</span>
                </p>
                <p>
                  <span className="font-medium">提示词：</span>
                  {truncatePrompt(deleteTarget.prompt, 80)}
                </p>
                <p>
                  <span className="font-medium">创建时间：</span>
                  {formatDateTime(deleteTarget.created_at)}
                </p>
                <p>
                  <span className="font-medium">状态：</span>
                  {STATUS_LABELS[deleteTarget.status] || deleteTarget.status}
                </p>
              </div>
            </DialogDescription>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  "确认删除"
                )}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}