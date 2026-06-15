import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Image,
  Video,
  Clock,
  Download,
  Eye,
  Trash2,
  Loader2,
  LayoutGrid,
  List,
  Film,
  ImageIcon,
  Search,
  Wand2,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { useGenerations, useDeleteGeneration, useBatchDeleteGenerations, usePollActiveItems } from "@/hooks/useGeneration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { downloadFile } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { Generation } from "@/types/generation";

// ── Constants ────────────────────────────────────────────────────────────

const STALE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes — treat queued/in_progress as "timed out" after this

const MODE_LABELS: Record<string, string> = {
  text2img: "文生图",
  img2img: "图生图",
  text2vid: "文生视频",
  img2vid: "图生视频",
  multimg: "多图生视频",
  keyframes: "关键帧",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  in_progress: "生成中",
  completed: "已完成",
  failed: "失败",
  timed_out: "超时",
};

// ── Helpers ──────────────────────────────────────────────────────────────

/** Determine the effective display status — treats long-running queued/in_progress as timed_out */
type EffectiveStatus = "completed" | "failed" | "queued" | "in_progress" | "timed_out";

function getEffectiveStatus(gen: Generation): EffectiveStatus {
  if (gen.status === "completed") return "completed";
  if (gen.status === "failed") return "failed";

  // Check if queued/in_progress has been running too long
  const createdAt = new Date(gen.created_at).getTime();
  const now = Date.now();
  if (now - createdAt > STALE_TIMEOUT_MS) return "timed_out";

  return gen.status as EffectiveStatus;
}

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

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  return formatDateTime(dateStr);
}

function truncatePrompt(text: string, max = 60): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EffectiveStatus }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed" || status === "timed_out"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{STATUS_LABELS[status] || status}</Badge>;
}

// ── Thumbnail for table/grid ─────────────────────────────────────────────

function GenerationThumbnail({ gen, size = 60 }: { gen: Generation; size?: number }) {
  const effective = getEffectiveStatus(gen);

  if (effective === "completed" && gen.type === "video" && gen.video_url) {
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <video
          src={gen.video_url}
          muted
          className="h-full w-full rounded-md object-cover"
          style={{ pointerEvents: "none" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="h-4 w-4 text-white drop-shadow-md" />
        </div>
      </div>
    );
  }
  if (effective === "completed" && gen.type === "image" && gen.image_url) {
    return (
      <img
        src={gen.image_url}
        alt={gen.prompt}
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  // Placeholder for no preview / in-progress / failed / timed-out
  return (
    <div
      className="flex items-center justify-center rounded-md bg-muted"
      style={{ width: size, height: size }}
    >
      {gen.type === "video" ? (
        <Film className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export default function History() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("image");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [preview, setPreview] = useState<Generation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Generation | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const effectiveStatus = statusFilter === "all" ? undefined : statusFilter;
  const effectiveMode = modeFilter === "all" ? undefined : modeFilter;

  const { data, isLoading, isError } = useGenerations(tab, page, 20, searchQuery, effectiveStatus, effectiveMode);
  const deleteMutation = useDeleteGeneration();
  const batchDeleteMutation = useBatchDeleteGenerations();

  // Clear selection when switching tabs or filters
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, searchQuery, statusFilter, modeFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === mergedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mergedItems.map((g) => g.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    batchDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
        setShowBatchDeleteConfirm(false);
      },
    });
  };

  // Identify active (in-progress/queued) items from the list — poll only these
  const activeIds = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((g) => g.status === "queued" || g.status === "in_progress")
      .map((g) => g.id);
  }, [data]);

  const pollResults = usePollActiveItems(activeIds);

  // Merge: replace list items with fresh poll data where available
  const mergedItems = useMemo(() => {
    if (!data) return [];
    if (!pollResults.data || pollResults.data.length === 0) return data.items;

    // Build a map from poll results for quick lookup
    const pollMap = new Map<number, Generation>();
    for (const p of pollResults.data) {
      pollMap.set(p.id, p);
    }

    return data.items.map((item) => pollMap.get(item.id) || item);
  }, [data, pollResults.data]);

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  // Auto-correct page when it exceeds totalPages (e.g. after deleting all items on last page)
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleRegenerate = (gen: Generation) => {
    const params = new URLSearchParams({
      prompt: gen.prompt,
      mode: gen.mode,
      size: gen.size,
    });
    if (gen.type === "video") {
      if (gen.num_frames) params.set("num_frames", String(gen.num_frames));
      if (gen.frame_rate) params.set("frame_rate", String(gen.frame_rate));
      navigate(`/generate/video?${params.toString()}`);
    } else {
      navigate(`/generate/image?${params.toString()}`);
    }
  };

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

      {/* ── Tabs + View Toggle ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); setSearchInput(""); setSearchQuery(""); setStatusFilter("all"); setModeFilter("all"); }}>
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

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
            title="网格视图"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("table")}
            title="列表视图"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Search + Filters ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[400px]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索提示词..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch} className="h-9">
            搜索
          </Button>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(1); }}
              className="h-9 text-muted-foreground"
            >
              清除
            </Button>
          )}
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="in_progress">生成中</SelectItem>
            <SelectItem value="queued">排队中</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>

        {/* Mode filter */}
        <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="模式筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部模式</SelectItem>
            {tab === "image" ? (
              <>
                <SelectItem value="text2img">文生图</SelectItem>
                <SelectItem value="img2img">图生图</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="text2vid">文生视频</SelectItem>
                <SelectItem value="img2vid">图生视频</SelectItem>
                <SelectItem value="multimg">多图生视频</SelectItem>
                <SelectItem value="keyframes">关键帧</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* ── Batch Action Bar ──────────────────────────────────────── */}
      {data && mergedItems.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm hover:text-foreground transition-colors"
            >
              <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                selectedIds.size === mergedItems.length && mergedItems.length > 0
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/40"
              }`}>
                {selectedIds.size === mergedItems.length && mergedItems.length > 0 && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              全选
            </button>
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                已选 {selectedIds.size} 项
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBatchDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              批量删除
            </Button>
          )}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────── */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {isError && !data && (
        <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
          加载失败，请稍后重试
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────── */}
      {data && mergedItems.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <p>暂无 {tab === "image" ? "图片" : "视频"} 记录</p>
        </div>
      )}

      {/* ── Grid View ─────────────────────────────────────────────────── */}
      {data && mergedItems.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mergedItems.map((gen) => {
            const effective = getEffectiveStatus(gen);
            const isFailedOrTimeout = effective === "failed" || effective === "timed_out";
            const isProcessing = effective === "queued" || effective === "in_progress";

            return (
              <Card
                key={gen.id}
                className={`group overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                  isFailedOrTimeout ? "border-destructive/40" : ""
                } ${selectedIds.has(gen.id) ? "ring-2 ring-primary" : ""}`}
              >
                <CardContent className="p-0">
                  {/* Selection checkbox */}
                  <div
                    className={`absolute top-2 left-2 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                      selectedIds.has(gen.id)
                        ? "bg-primary border-primary"
                        : "border-white/70 bg-black/20 opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(gen.id); }}
                  >
                    {selectedIds.has(gen.id) && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  {/* Thumbnail area */}
                  <div
                    className="relative bg-muted overflow-hidden"
                    style={{ aspectRatio: "1" }}
                    onClick={() => setPreview(gen)}
                  >
                    {/* Completed: show media */}
                    {effective === "completed" ? (
                      gen.type === "video" && gen.video_url ? (
                        <video
                          src={gen.video_url}
                          muted
                          className="h-full w-full object-cover"
                          style={{ pointerEvents: "none" }}
                        />
                      ) : gen.type === "image" && gen.image_url ? (
                        <img
                          src={gen.image_url}
                          alt={gen.prompt}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          {gen.type === "video" ? <Film className="h-8 w-8 text-muted-foreground" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                        </div>
                      )
                    ) : isProcessing ? (
                      /* Processing: subtle spinner */
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                          <p className="text-xs text-muted-foreground mt-2">
                            {STATUS_LABELS[effective]}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Failed or timed-out: error icon */
                      <div className="flex items-center justify-center h-full bg-destructive/5">
                        <div className="text-center">
                          {effective === "timed_out" ? (
                            <AlertTriangle className="h-8 w-8 text-destructive/60 mx-auto" />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-destructive/40 mx-auto" />
                          )}
                          <p className="text-xs text-destructive/70 mt-1">
                            {STATUS_LABELS[effective]}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Progress overlay for processing */}
                    {isProcessing && gen.progress != null && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1.5">
                        <div className="flex items-center justify-between text-xs text-white">
                          <span>{STATUS_LABELS[effective]}</span>
                          <span>{gen.progress}%</span>
                        </div>
                        <Progress value={gen.progress} className="h-1.5 mt-1" />
                      </div>
                    )}

                    {/* Hover actions overlay */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 shadow-md"
                        title="重新生成"
                        onClick={(e) => { e.stopPropagation(); handleRegenerate(gen); }}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 shadow-md"
                        title="预览"
                        onClick={(e) => { e.stopPropagation(); setPreview(gen); }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {(gen.image_url || gen.video_url) && (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 shadow-md"
                          title="下载"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(gen.video_url || gen.image_url!);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 shadow-md text-destructive hover:text-destructive"
                        title="删除"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(gen); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Card info — always present, consistent style */}
                  <div className="p-3 space-y-1.5">
                    <p className="text-sm font-medium line-clamp-2" title={gen.prompt}>
                      {truncatePrompt(gen.prompt, 80)}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{MODE_LABELS[gen.mode] || gen.mode}</span>
                        <StatusBadge status={effective} />
                      </div>
                      <span className="text-muted-foreground">{formatRelativeTime(gen.created_at)}</span>
                    </div>
                    {/* Error hint for failed/timed-out */}
                    {isFailedOrTimeout && gen.error && (
                      <p className="text-xs text-destructive/70 line-clamp-1" title={gen.error}>
                        {truncatePrompt(gen.error, 50)}
                      </p>
                    )}
                    {effective === "timed_out" && !gen.error && (
                      <p className="text-xs text-destructive/70">
                        任务可能已丢失，建议删除后重试
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Table View ─────────────────────────────────────────────────── */}
      {data && mergedItems.length > 0 && viewMode === "table" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                      selectedIds.size === mergedItems.length && mergedItems.length > 0
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {selectedIds.size === mergedItems.length && mergedItems.length > 0 && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="w-[70px]">预览</TableHead>
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

                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[130px]">创建时间</TableHead>
                <TableHead className="w-[110px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedItems.map((gen) => {
                const effective = getEffectiveStatus(gen);
                const isFailedOrTimeout = effective === "failed" || effective === "timed_out";

                return (
                  <TableRow key={gen.id} className={isFailedOrTimeout ? "bg-destructive/5" : ""}>
                    {/* Selection checkbox */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleSelect(gen.id)}
                        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                          selectedIds.has(gen.id)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {selectedIds.has(gen.id) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </button>
                    </TableCell>

                    {/* ID */}
                    <TableCell className="font-mono text-xs">
                      #{gen.id}
                    </TableCell>

                    {/* Thumbnail */}
                    <TableCell>
                      <GenerationThumbnail gen={gen} size={56} />
                    </TableCell>

                    {/* Prompt */}
                    <TableCell
                      className="max-w-[200px] truncate"
                      title={gen.prompt}
                    >
                      {truncatePrompt(gen.prompt)}
                      {isFailedOrTimeout && gen.error && (
                        <p className="text-xs text-destructive/70 truncate mt-0.5" title={gen.error}>
                          {truncatePrompt(gen.error, 40)}
                        </p>
                      )}
                      {effective === "timed_out" && !gen.error && (
                        <p className="text-xs text-destructive/70 mt-0.5">任务超时</p>
                      )}
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
                        <StatusBadge status={effective} />
                        {(effective === "in_progress" || effective === "queued") && gen.progress != null && (
                          <Progress value={gen.progress} className="h-1" />
                        )}
                      </div>
                    </TableCell>

                    {/* Created At */}
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatRelativeTime(gen.created_at)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="重新生成"
                          onClick={() => handleRegenerate(gen)}
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="下载"
                            onClick={() => downloadFile(gen.video_url || gen.image_url!)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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
                );
              })}
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

      {/* ── Pagination for Grid View ─────────────────────────────── */}
      {data && mergedItems.length > 0 && viewMode === "grid" && (
        <div className="flex items-center justify-between px-4 py-3">
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
      )}

      {/* ── Preview Dialog ─────────────────────────────────────────── */}
      <Dialog open={preview !== null} onOpenChange={() => { setPreview(null); setPromptExpanded(false); setPromptCopied(false); }}>
        {preview && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col md:flex-row gap-6">

              {/* ── Left: Media + Reference Images ─────────────────── */}
              <div className="flex-1 min-w-0 space-y-4 pt-4">
                {/* Media preview */}
                <div className="flex items-center justify-center rounded-lg bg-muted min-h-[240px] overflow-hidden">
                  {preview.type === "video" && preview.video_url ? (
                    <video
                      src={preview.video_url}
                      controls
                      autoPlay
                      className="max-h-[55vh] w-full object-contain"
                    />
                  ) : preview.image_url ? (
                    <img
                      src={preview.image_url}
                      alt={preview.prompt}
                      className="max-h-[55vh] w-full object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[240px] text-muted-foreground">
                      <Image className="h-8 w-8" />
                      <span className="ml-2">暂无预览</span>
                    </div>
                  )}
                </div>

                {/* Reference/input images */}
                {preview.input_images && preview.input_images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">参考图片</p>
                    <div className="flex flex-wrap gap-2">
                      {preview.input_images.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block rounded-lg overflow-hidden border"
                        >
                          <img
                            src={url}
                            alt={`参考图片 ${i + 1}`}
                            className="h-24 w-24 object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Download className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: Info Panel ──────────────────────────────── */}
              <div className="w-full md:w-[300px] shrink-0 space-y-5 pt-4">
                {/* Prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">提示词</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        navigator.clipboard.writeText(preview.prompt);
                        setPromptCopied(true);
                        setTimeout(() => setPromptCopied(false), 2000);
                      }}
                    >
                      {promptCopied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p
                    className={`text-sm leading-relaxed break-words ${promptExpanded ? "" : "line-clamp-3"}`}
                  >
                    {preview.prompt}
                  </p>
                  {preview.prompt.length > 120 && (
                    <button
                      type="button"
                      onClick={() => setPromptExpanded((v) => !v)}
                      className="text-xs text-primary hover:underline"
                    >
                      {promptExpanded ? "收起" : "展开全文"}
                    </button>
                  )}
                </div>

                {/* Error / timeout message */}
                {(preview.error || getEffectiveStatus(preview) === "timed_out") && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                    <p className="text-xs font-medium text-destructive">
                      {getEffectiveStatus(preview) === "timed_out" ? "超时提示" : "错误信息"}
                    </p>
                    <p className="text-sm text-destructive/90 break-words font-mono">
                      {preview.error || "任务已超过30分钟未完成，可能已丢失。建议删除后重新生成。"}
                    </p>
                  </div>
                )}

                {/* Progress */}
                {getEffectiveStatus(preview) === "in_progress" && preview.progress != null && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">生成进度</p>
                    <Progress value={preview.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{preview.progress}%</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">ID</span>
                    <span className="font-mono text-xs text-muted-foreground">#{preview.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">状态</span>
                    <StatusBadge status={getEffectiveStatus(preview)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">模型</span>
                    <span className="font-mono text-xs">{getModelName(preview)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">模式</span>
                    <span className="text-sm">{MODE_LABELS[preview.mode] || preview.mode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">尺寸</span>
                    <span className="text-sm">{preview.size}</span>
                  </div>
                  {preview.type === "video" && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">时长</span>
                      <span className="text-sm">
                        {formatDuration(preview.num_frames, preview.frame_rate)}
                        {preview.num_frames && (
                          <span className="text-muted-foreground ml-1">({preview.num_frames}f)</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">创建时间</span>
                    <span className="text-sm">{formatDateTime(preview.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2 border-t">
                  {(preview.image_url || preview.video_url) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => downloadFile(preview.video_url || preview.image_url!)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      下载
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleRegenerate(preview)} className="w-full">
                    <Wand2 className="h-4 w-4 mr-2" />
                    重新生成
                  </Button>
                </div>
              </div>
            </div>
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
                  {STATUS_LABELS[getEffectiveStatus(deleteTarget)] || deleteTarget.status}
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

      {/* ── Batch Delete Confirmation Dialog ──────────────────────── */}
      <Dialog
        open={showBatchDeleteConfirm}
        onOpenChange={setShowBatchDeleteConfirm}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量删除确认</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            <p>确定要删除选中的 <span className="font-medium text-foreground">{selectedIds.size}</span> 条记录吗？此操作不可撤销。</p>
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBatchDeleteConfirm(false)}
              disabled={batchDeleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              disabled={batchDeleteMutation.isPending}
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                `删除 ${selectedIds.size} 项`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
