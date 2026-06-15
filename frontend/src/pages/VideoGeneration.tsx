import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  Film,
  Upload,
  Download,
  X,
  RefreshCw,
} from "lucide-react";
import { useGenerateVideo, useVideoGeneration, useUploadImage } from "@/hooks/useGeneration";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const ASPECT_RATIOS = [
  { label: "16:9 (横屏视频、产品演示、官网展示、YouTube 风格内容)", width: 1152, height: 768 },
  { label: "9:16 (竖屏短视频、移动端内容、TikTok / Reels / Shorts 风格内容)", width: 768, height: 1152 },
  { label: "1:1 (方形视频、社交媒体 Feed、角色或商品展示)", width: 1024, height: 1024 },
  { label: "4:3 (传统横向画幅、通用展示内容)", width: 1152, height: 864 },
  { label: "3:4 (竖向展示、人物或商品主体突出的视频内容)", width: 864, height: 1152 },
];

const DURATION_PRESETS = [
  { label: "3秒", frames: 81, estimate: "约 30~60 秒" },
  { label: "5秒", frames: 121, estimate: "约 1~2 分钟" },
  { label: "10秒", frames: 241, estimate: "约 2~3 分钟" },
  { label: "18秒", frames: 441, estimate: "约 3~5 分钟" },
];

export default function VideoGeneration() {
  const [searchParams] = useSearchParams();
  const [provider, setProvider] = useState("agnes");
  const [mode, setMode] = useState("text2vid");
  const [prompt, setPrompt] = useState("");
  const [aspectIndex, setAspectIndex] = useState(0);
  const [framesIndex, setFramesIndex] = useState(1); // default ~5s
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageCosKeys, setImageCosKeys] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [pollingId, setPollingId] = useState<number | null>(null);

  // Pre-fill form from URL searchParams (for "regenerate" from history)
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
        const idx = ASPECT_RATIOS.findIndex((a) => a.width === w && a.height === h);
        if (idx >= 0) setAspectIndex(idx);
      }
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
        // img2vid only keeps the latest single image
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

  // Image count validation for different modes
  const requiredImages = mode === "text2vid" ? 0 : mode === "img2vid" ? 1 : 2;
  const hasEnoughImages = imageUrls.length >= requiredImages;
  const canGenerate = prompt.trim() !== "" && hasEnoughImages && !generateMutation.isPending && !isPolling;

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
        ...(imageUrls.length > 0 ? { image_urls: imageUrls, image_cos_keys: imageCosKeys } : {}),
      },
      {
        onSuccess: (data) => {
          setPollingId(data.id);
        },
      },
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

  const showPolling =
    pollingId !== null &&
    pollData &&
    !isTerminal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">视频生成</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>参数设置</CardTitle>
            <CardDescription>选择模式和输入提示词</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model */}
            <div className="space-y-2">
              <Label>模型</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agnes">agnes-video-v2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode */}
            <div className="space-y-2">
              <Label>生成模式</Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger>
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

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label>画面比例</Label>
              <Select
                value={String(aspectIndex)}
                onValueChange={(v) => setAspectIndex(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((a, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>时长</Label>
              <Select
                value={String(framesIndex)}
                onValueChange={(v) => setFramesIndex(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference images (img2vid / multimg / keyframes) */}
            {mode !== "text2vid" && (
              <div className="space-y-2">
                <Label>
                  {mode === "img2vid" ? "参考图片" : mode === "multimg" ? "参考图片（多张）" : "关键帧图片（多张）"}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={mode !== "img2vid"}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadMutation.isPending ? "上传中..." : "选择图片"}
                  </Button>
                </div>

                {/* Preview */}
                {previewUrls.length > 0 && (
                  mode === "img2vid" ? (
                    // Single image preview (img2vid)
                    <div className="relative group mt-2 w-fit">
                      <img
                        src={previewUrls[0]}
                        alt="参考图片"
                        className="h-32 w-auto rounded-md object-cover"
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
                    // Grid preview (multimg / keyframes)
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`参考图片 ${index + 1}`}
                            className="h-24 w-full rounded-md object-cover"
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
                  )
                )}

                {uploadMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    上传中...
                  </div>
                )}

                {!hasEnoughImages && requiredImages > 0 && !uploadMutation.isPending && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === "img2vid"
                      ? "需要上传 1 张参考图片"
                      : `需要上传至少 2 张图片（已上传 ${imageUrls.length} 张）`}
                  </p>
                )}
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <Label>提示词</Label>
              <Textarea
                placeholder="描述你想要的视频内容..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex-1"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Film className="h-4 w-4" />
                    生成
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                重置
              </Button>
            </div>

            {/* Error */}
            {generateMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : "提交失败"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result / Polling */}
        <Card>
          <CardHeader>
            <CardTitle>生成结果</CardTitle>
            <CardDescription>
              {showPolling
                ? "视频正在生成中..."
                : "生成的视频将显示在这里"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Polling state */}
            {showPolling && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {pollData?.status === "queued" && "排队中..."}
                  {pollData?.status === "in_progress" &&
                    `生成中 (${pollData?.progress ?? 0}%)`}
                </div>
                {pollData?.progress != null && (
                  <Progress value={pollData.progress} className="h-2" />
                )}
                {pollData?.status === "in_progress" && (
                  <p className="text-center text-xs text-muted-foreground">
                    {DURATION_PRESETS[framesIndex].estimate}
                  </p>
                )}
              </div>
            )}

            {/* Completed */}
            {pollData?.status === "completed" && pollData.video_url && (
              <div className="space-y-3">
                <video
                  src={pollData.video_url}
                  controls
                  autoPlay
                  className="w-full rounded-lg"
                />
                <div className="flex gap-2">
                  <a
                    href={pollData.video_url}
                    download
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="h-4 w-4" />
                      下载
                    </Button>
                  </a>
                  <Button size="sm" onClick={resetForm} className="flex-1">
                    <RefreshCw className="h-4 w-4" />
                    继续生成
                  </Button>
                </div>
              </div>
            )}

            {/* Failed */}
            {pollData?.status === "failed" && (
              <div className="space-y-4 py-8 text-center">
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {pollData.error || "视频生成失败"}
                </div>
                <Button variant="outline" onClick={resetForm}>
                  <RefreshCw className="h-4 w-4" />
                  重试
                </Button>
              </div>
            )}

            {/* Idle state */}
            {!pollingId && !generateMutation.isPending && (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed">
                <div className="text-center text-muted-foreground">
                  <Film className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-sm">填写参数并点击生成</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}