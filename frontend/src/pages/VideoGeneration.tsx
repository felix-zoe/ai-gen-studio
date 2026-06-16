import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  Film,
  Upload,
  Download,
  X,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  useGenerateVideo,
  useVideoGeneration,
  useUploadImage,
} from "@/hooks/useGeneration";
import { downloadFile } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ASPECT_RATIOS = [
  { label: "16:9", desc: "横屏视频", width: 1152, height: 768, w: 16, h: 9 },
  { label: "9:16", desc: "竖屏短视频", width: 768, height: 1152, w: 9, h: 16 },
  { label: "1:1", desc: "方形视频", width: 1024, height: 1024, w: 1, h: 1 },
  { label: "4:3", desc: "传统横屏", width: 1152, height: 864, w: 4, h: 3 },
  { label: "3:4", desc: "竖向展示", width: 864, height: 1152, w: 3, h: 4 },
];

const DURATION_PRESETS = [
  { label: "3秒", frames: 81, estimate: "约 30~60 秒" },
  { label: "5秒", frames: 121, estimate: "约 1~2 分钟" },
  { label: "10秒", frames: 241, estimate: "约 2~3 分钟" },
  { label: "18秒", frames: 441, estimate: "约 3~5 分钟" },
];

/* Segmented duration control */
function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {DURATION_PRESETS.map((d, i) => {
        const isActive = i === value;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-2.5 transition-all ${
              isActive
                ? "bg-[hsl(var(--accent))] ring-1 ring-primary"
                : "hover:bg-[hsl(var(--surface-2))]"
            }`}
          >
            <span
              className={`text-[13px] font-medium ${
                isActive
                  ? "text-[hsl(var(--accent-foreground))]"
                  : "text-foreground"
              }`}
            >
              {d.label}
            </span>
            <span
              className={`text-[10px] ${
                isActive ? "text-[hsl(var(--accent-foreground))]/70" : "text-muted-foreground"
              }`}
            >
              {d.estimate}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Visual aspect ratio picker for video */
function AspectPicker({
  ratios,
  value,
  onChange,
}: {
  ratios: typeof ASPECT_RATIOS;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ratios.map((r, i) => {
        const isActive = i === value;
        const maxDim = 24;
        const ratio = r.w / r.h;
        let boxW: number, boxH: number;
        if (ratio >= 1) {
          boxW = maxDim;
          boxH = maxDim / ratio;
        } else {
          boxH = maxDim;
          boxW = maxDim * ratio;
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 transition-all ${
              isActive
                ? "bg-[hsl(var(--accent))] ring-1 ring-primary"
                : "hover:bg-[hsl(var(--surface-2))]"
            }`}
          >
            <div
              className={`rounded-[2px] border transition-colors ${
                isActive
                  ? "border-primary bg-primary/15"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]"
              }`}
              style={{ width: boxW, height: boxH }}
            />
            <span
              className={`text-[10px] font-medium leading-none ${
                isActive
                  ? "text-[hsl(var(--accent-foreground))]"
                  : "text-muted-foreground"
              }`}
            >
              {r.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Circular progress indicator */
function CircularProgress({
  progress,
  statusText,
  stageText,
}: {
  progress: number;
  statusText: string;
  stageText: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="96" height="96" className="-rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="hsl(var(--surface-2))"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[16px] font-semibold text-foreground">
            {progress}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[14px] font-medium text-foreground">{statusText}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{stageText}</p>
      </div>
    </div>
  );
}

/* Empty state illustration for video */
function VideoEmptyIllustration() {
  return (
    <svg
      className="mx-auto h-24 w-24 text-primary/20"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Film frame */}
      <rect
        x="12"
        y="20"
        width="72"
        height="56"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Film sprockets */}
      <rect x="18" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="28" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="38" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="48" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="58" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="68" y="20" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="18" y="70" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="28" y="70" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="38" y="70" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="48" y="70" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="58" y="70" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="68" y="70" width="4" height="6" rx="1" fill="currentColor" opacity="0.3" />
      {/* Play triangle */}
      <path d="M40 38L58 48L40 58V38Z" fill="currentColor" opacity="0.15" />
      <path
        d="M40 38L58 48L40 58V38Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function VideoGeneration() {
  const [searchParams] = useSearchParams();
  const [provider, setProvider] = useState("agnes");
  const [mode, setMode] = useState("text2vid");
  const [prompt, setPrompt] = useState("");
  const [aspectIndex, setAspectIndex] = useState(0);
  const [framesIndex, setFramesIndex] = useState(1);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageCosKeys, setImageCosKeys] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [pollingId, setPollingId] = useState<number | null>(null);

  useEffect(() => {
    const sp = searchParams;
    if (sp.get("prompt")) setPrompt(sp.get("prompt")!);
    if (sp.get("mode")) setMode(sp.get("mode")!);
    if (sp.get("size")) {
      const sizeStr = sp.get("size")!;
      const match = sizeStr.match(/^(\d+)x(\d+)$/);
      if (match) {
        const w = parseInt(match[1]);
        const h = parseInt(match[2]);
        const idx = ASPECT_RATIOS.findIndex(
          (a) => a.width === w && a.height === h,
        );
        if (idx >= 0) setAspectIndex(idx);
      }
    }
    if (sp.get("num_frames")) {
      const frames = parseInt(sp.get("num_frames")!);
      const idx = DURATION_PRESETS.findIndex((p) => p.frames === frames);
      if (idx >= 0) setFramesIndex(idx);
    }
  }, [searchParams]);

  const generateMutation = useGenerateVideo();
  const uploadMutation = useUploadImage();
  const pollQuery = useVideoGeneration(pollingId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspect = ASPECT_RATIOS[aspectIndex];
  const preset = DURATION_PRESETS[framesIndex];
  const frameRate = 24;

  const pollData = pollQuery.data;
  const isTerminal =
    pollData?.status === "completed" || pollData?.status === "failed";
  const isPolling = pollingId !== null && pollData && !isTerminal;

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    setImageUrls([]);
    setImageCosKeys([]);
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const uploads = Array.from(files).map((file) =>
        uploadMutation.mutateAsync(file),
      );
      const results = await Promise.all(uploads);
      const newUrls = results.map((r) => r.url);
      const newCosKeys = results.map((r) => r.cos_key);
      if (mode === "img2vid") {
        setImageUrls(newUrls.slice(0, 1));
        setImageCosKeys(newCosKeys.slice(0, 1));
        setPreviewUrls(newUrls.slice(0, 1));
      } else {
        setImageUrls((prev) => [...prev, ...newUrls]);
        setImageCosKeys((prev) => [...prev, ...newCosKeys]);
        setPreviewUrls((prev) => [...prev, ...newUrls]);
      }
    } catch {
      // handled
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setImageCosKeys((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const requiredImages = mode === "text2vid" ? 0 : mode === "img2vid" ? 1 : 2;
  const hasEnoughImages = imageUrls.length >= requiredImages;
  const canGenerate =
    prompt.trim() !== "" &&
    hasEnoughImages &&
    !generateMutation.isPending &&
    !isPolling;

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateMutation.mutate(
      {
        provider,
        mode,
        prompt: prompt.trim(),
        width: aspect.width,
        height: aspect.height,
        num_frames: preset.frames,
        frame_rate: frameRate,
        ...(imageUrls.length > 0
          ? { image_urls: imageUrls, image_cos_keys: imageCosKeys }
          : {}),
      },
      { onSuccess: (data) => setPollingId(data.id) },
    );
  };

  const resetForm = () => {
    setPollingId(null);
    setPrompt("");
    setImageUrls([]);
    setImageCosKeys([]);
    setPreviewUrls([]);
    generateMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const showPolling = pollingId !== null && pollData && !isTerminal;

  const getStageText = () => {
    if (pollData?.status === "queued") return "排队等待处理...";
    if (pollData?.status === "in_progress") {
      const p = pollData?.progress ?? 0;
      if (p < 30) return "处理中...";
      if (p < 80) return "渲染中...";
      return "即将完成...";
    }
    return "";
  };

  return (
    <div className="flex gap-0 min-h-[calc(100vh-120px)]">
      {/* Left: Form panel */}
      <div className="w-[380px] shrink-0 border-r border-[hsl(var(--border-light))] px-6 overflow-y-auto">
        <div className="space-y-6">
          {/* Model & Mode */}
          <div className="space-y-4">
            <p className="section-header">模型设置</p>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">模型</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agnes">agnes-video-v2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">生成模式</Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text2vid">文生视频</SelectItem>
                  <SelectItem value="img2vid">图生视频</SelectItem>
                  <SelectItem value="multimg">多图生成</SelectItem>
                  <SelectItem value="keyframes">关键帧动画</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-px bg-[hsl(var(--border-light))]" />

          {/* Aspect Ratio */}
          <div className="space-y-3">
            <p className="section-header">画面比例</p>
            <AspectPicker
              ratios={ASPECT_RATIOS}
              value={aspectIndex}
              onChange={setAspectIndex}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              {aspect.label} · {aspect.desc}
            </p>
          </div>

          <div className="h-px bg-[hsl(var(--border-light))]" />

          {/* Duration */}
          <div className="space-y-3">
            <p className="section-header">视频时长</p>
            <DurationPicker value={framesIndex} onChange={setFramesIndex} />
          </div>

          <div className="h-px bg-[hsl(var(--border-light))]" />

          {/* Reference images */}
          {mode !== "text2vid" && (
            <>
              <div className="space-y-3">
                <p className="section-header">
                  {mode === "img2vid"
                    ? "参考图片"
                    : mode === "multimg"
                      ? "参考图片（多张）"
                      : "关键帧图片"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={mode !== "img2vid"}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] py-4 text-[13px] text-muted-foreground transition-all hover:border-primary hover:text-primary hover:bg-[hsl(var(--accent))]"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      点击上传图片
                    </>
                  )}
                </button>

                {previewUrls.length > 0 &&
                  (mode === "img2vid" ? (
                    <div className="relative group w-fit">
                      <img
                        src={previewUrls[0]}
                        alt="参考图片"
                        className="h-28 w-auto rounded-md object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(0)}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`参考图片 ${index + 1}`}
                            className="h-20 w-full rounded-md object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}

                {!hasEnoughImages &&
                  requiredImages > 0 &&
                  !uploadMutation.isPending && (
                    <p className="text-[11px] text-muted-foreground">
                      {mode === "img2vid"
                        ? "需要上传 1 张参考图片"
                        : `需要上传至少 2 张图片（已上传 ${imageUrls.length} 张）`}
                    </p>
                  )}
              </div>
              <div className="h-px bg-[hsl(var(--border-light))]" />
            </>
          )}

          {/* Prompt */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-header">提示词</p>
              <span className="text-[11px] text-muted-foreground">
                {prompt.length}/4000
              </span>
            </div>
            <Textarea
              placeholder="描述你想要的视频内容，包括场景、动作、镜头运动..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={4000}
              className="min-h-[120px] resize-y text-[14px] leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  提交中...
                </>
              ) : (
                <>
                  <Film className="h-4 w-4 mr-1.5" />
                  生成视频
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={resetForm}
              className="h-11 px-4 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Error */}
          {generateMutation.isError && (
            <div className="flex items-start gap-2.5 rounded-lg border-l-[3px] border-destructive bg-destructive/5 px-4 py-3">
              <p className="text-[13px] text-destructive">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : "提交失败，请稍后重试"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Result area */}
      <div className="flex-1 pl-8 flex items-start justify-center">
        <div className="w-full max-w-2xl">
          {/* Polling state */}
          {showPolling && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <CircularProgress
                progress={pollData?.progress ?? 0}
                statusText={
                  pollData?.status === "queued"
                    ? "排队中"
                    : `生成中 ${pollData?.progress ?? 0}%`
                }
                stageText={getStageText()}
              />
              <p className="mt-6 text-[12px] text-muted-foreground">
                预计耗时 {preset.estimate}
              </p>
            </div>
          )}

          {/* Completed */}
          {pollData?.status === "completed" && pollData.video_url && (
            <div className="space-y-4 animate-fade-in">
              <div className="overflow-hidden rounded-lg bg-[#1A1D23]">
                <video
                  src={pollData.video_url}
                  controls
                  autoPlay
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-lg"
                  onClick={() => downloadFile(pollData.video_url!)}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  下载视频
                </Button>
                <Button
                  className="flex-1 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={resetForm}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  继续生成
                </Button>
              </div>
            </div>
          )}

          {/* Failed */}
          {pollData?.status === "failed" && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="flex items-start gap-2.5 rounded-lg border-l-[3px] border-destructive bg-destructive/5 px-4 py-3 max-w-md">
                <p className="text-[13px] text-destructive">
                  {pollData.error || "视频生成失败，请重试"}
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-6"
                onClick={resetForm}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                重试
              </Button>
            </div>
          )}

          {/* Idle state */}
          {!pollingId && !generateMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-24">
              <VideoEmptyIllustration />
              <p className="mt-4 text-[14px] font-medium text-foreground">
                等待生成
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                在左侧设置参数，点击生成按钮创建视频
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
