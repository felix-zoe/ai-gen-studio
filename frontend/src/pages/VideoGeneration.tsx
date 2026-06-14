import { useState, useRef } from "react";
import {
  Loader2,
  Film,
  ImagePlus,
  Download,
  RefreshCw,
} from "lucide-react";
import { useGenerateVideo, useVideoGeneration, useUploadImage } from "@/hooks/useGeneration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  { label: "16:9 (横屏)", width: 1152, height: 768 },
  { label: "9:16 (竖屏)", width: 768, height: 1152 },
];

const DURATION_PRESETS = [
  { label: "~3 秒", frames: 81 },
  { label: "~5 秒", frames: 121 },
  { label: "~10 秒", frames: 241 },
  { label: "~18 秒", frames: 441 },
];

function formatDuration(frames: number, fps: number): string {
  return `${(frames / fps).toFixed(1)} 秒`;
}

export default function VideoGeneration() {
  const [mode, setMode] = useState("text2vid");
  const [prompt, setPrompt] = useState("");
  const [aspectIndex, setAspectIndex] = useState(0);
  const [framesIndex, setFramesIndex] = useState(1); // default ~5s
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const [pollingId, setPollingId] = useState<number | null>(null);

  const generateMutation = useGenerateVideo();
  const uploadMutation = useUploadImage();
  const pollQuery = useVideoGeneration(pollingId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspect = ASPECT_RATIOS[aspectIndex];
  const preset = DURATION_PRESETS[framesIndex];
  const frameRate = 24;

  const pollData = pollQuery.data;
  const isPolling = pollQuery.isFetching && pollingId !== null;
  const isTerminal =
    pollData?.status === "completed" || pollData?.status === "failed";

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMutation.mutateAsync(file);
      setImageUrl(result.url);
      setPreviewUrl(result.url);
    } catch {
      // handled
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateMutation.mutate(
      {
        provider: "agnes",
        mode,
        prompt: prompt.trim(),
        width: aspect.width,
        height: aspect.height,
        num_frames: preset.frames,
        frame_rate: frameRate,
        ...(mode === "img2vid" && imageUrl ? { image_url: imageUrl } : {}),
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
    setImageUrl("");
    setPreviewUrl("");
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
        <p className="text-muted-foreground">使用 Agnes Video 2.0 生成视频</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>参数设置</CardTitle>
            <CardDescription>选择模式和输入提示词</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode */}
            <div className="space-y-2">
              <Label>生成模式</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text2vid">文生视频</SelectItem>
                  <SelectItem value="img2vid">图生视频</SelectItem>
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
                      {d.label} ({formatDuration(d.frames, frameRate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference image (img2vid) */}
            {mode === "img2vid" && (
              <div className="space-y-2">
                <Label>参考图片</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="mt-2 h-32 w-auto rounded-md object-cover"
                  />
                )}
                {uploadMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    上传中...
                  </div>
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
                disabled={
                  generateMutation.isPending || isPolling || !prompt.trim()
                }
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