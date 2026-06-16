import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Upload, Wand2, Download, X, RotateCcw } from "lucide-react";
import { useGenerateImage, useUploadImage } from "@/hooks/useGeneration";
import { downloadGeneration } from "@/lib/utils";
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

const SENSENOVA_SIZES = [
  { ratio: "1:1", dim: "2048×2048", value: "2048x2048", w: 1, h: 1 },
  { ratio: "2:3", dim: "1664×2496", value: "1664x2496", w: 2, h: 3 },
  { ratio: "3:2", dim: "2496×1664", value: "2496x1664", w: 3, h: 2 },
  { ratio: "3:4", dim: "1760×2368", value: "1760x2368", w: 3, h: 4 },
  { ratio: "4:3", dim: "2368×1760", value: "2368x1760", w: 4, h: 3 },
  { ratio: "4:5", dim: "1824×2272", value: "1824x2272", w: 4, h: 5 },
  { ratio: "5:4", dim: "2272×1824", value: "2272x1824", w: 5, h: 4 },
  { ratio: "16:9", dim: "2752×1536", value: "2752x1536", w: 16, h: 9 },
  { ratio: "9:16", dim: "1536×2752", value: "1536x2752", w: 9, h: 16 },
  { ratio: "21:9", dim: "3072×1376", value: "3072x1376", w: 21, h: 9 },
  { ratio: "9:21", dim: "1344×3136", value: "1344x3136", w: 9, h: 21 },
];

const AGNES_FLASH_SIZES = [
  { ratio: "1:1", dim: "1024×1024", value: "1024x1024", w: 1, h: 1 },
  { ratio: "4:3", dim: "1024×768", value: "1024x768", w: 4, h: 3 },
  { ratio: "3:2", dim: "1152×768", value: "1152x768", w: 3, h: 2 },
  { ratio: "16:9", dim: "1024×576", value: "1024x576", w: 16, h: 9 },
  { ratio: "3:4", dim: "768×1024", value: "768x1024", w: 3, h: 4 },
  { ratio: "9:16", dim: "720×1280", value: "720x1280", w: 9, h: 16 },
  { ratio: "9:16", dim: "768×1366", value: "768x1366", w: 9, h: 16 },
];

/* Visual aspect ratio picker */
function RatioPicker({
  sizes,
  value,
  onChange,
}: {
  sizes: typeof SENSENOVA_SIZES;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {sizes.map((s) => {
        const isActive = s.value === value;
        const maxDim = 28;
        const ratio = s.w / s.h;
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
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
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
                isActive ? "text-[hsl(var(--accent-foreground))]" : "text-muted-foreground"
              }`}
            >
              {s.ratio}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* Empty state illustration */
function EmptyIllustration() {
  return (
    <svg
      className="mx-auto h-24 w-24 text-primary/20"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Canvas/frame */}
      <rect x="16" y="12" width="64" height="72" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Mountain landscape */}
      <path d="M16 64L32 48L44 56L60 36L80 60V80H16V64Z" fill="currentColor" opacity="0.1" />
      <path d="M16 64L32 48L44 56L60 36L80 60" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Sun */}
      <circle cx="60" cy="28" r="6" stroke="currentColor" strokeWidth="1.5" />
      {/* Sparkle */}
      <path d="M76 16L78 20L82 22L78 24L76 28L74 24L70 22L74 20L76 16Z" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/* Skeleton loading */
function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton aspect-square w-full rounded-lg" />
      <div className="flex gap-3">
        <div className="skeleton h-9 flex-1 rounded-md" />
        <div className="skeleton h-9 flex-1 rounded-md" />
      </div>
    </div>
  );
}

export default function ImageGeneration() {
  const [searchParams] = useSearchParams();
  const [provider, setProvider] = useState("sensenova");
  const [mode, setMode] = useState("text2img");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("2048x2048");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageCosKeys, setImageCosKeys] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Pre-fill form from URL searchParams (for "regenerate" from history)
  useEffect(() => {
    const sp = searchParams;
    if (sp.get("prompt")) setPrompt(sp.get("prompt")!);
    if (sp.get("mode") && sp.get("mode") === "img2img") {
      setMode("img2img");
      setProvider("agnes");
    }
    if (sp.get("size")) setSize(sp.get("size")!);
  }, [searchParams]);

  const sizes = provider === "agnes" ? AGNES_FLASH_SIZES : SENSENOVA_SIZES;

  useEffect(() => {
    if (mode === "img2img") setProvider("agnes");
  }, [mode]);

  useEffect(() => {
    if (provider === "sensenova" && mode === "img2img") setMode("text2img");
  }, [provider]);

  useEffect(() => {
    const validSizes = provider === "agnes" ? AGNES_FLASH_SIZES : SENSENOVA_SIZES;
    if (!validSizes.some((s) => s.value === size)) {
      setSize(validSizes[0].value);
    }
  }, [provider]);

  const generateMutation = useGenerateImage();
  const uploadMutation = useUploadImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setImageUrls((prev) => [...prev, ...newUrls]);
      setImageCosKeys((prev) => [...prev, ...newCosKeys]);
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    } catch {
      // error handled by mutation
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setImageCosKeys((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateMutation.mutate({
      provider,
      mode,
      prompt: prompt.trim(),
      size,
      ...(mode === "img2img" && imageUrls.length > 0
        ? { image_urls: imageUrls, image_cos_keys: imageCosKeys }
        : {}),
    });
  };

  const resetForm = () => {
    setPrompt("");
    setImageUrls([]);
    setImageCosKeys([]);
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const result = generateMutation.data;
  const isPending = generateMutation.isPending;

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
                  <SelectItem value="sensenova">sensenova-u1-fast</SelectItem>
                  <SelectItem value="agnes">agnes-image-2.1-flash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium">生成模式</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text2img">文生图</SelectItem>
                  {provider === "agnes" && (
                    <SelectItem value="img2img">图生图</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[hsl(var(--border-light))]" />

          {/* Size picker */}
          <div className="space-y-3">
            <p className="section-header">画面尺寸</p>
            <RatioPicker sizes={sizes} value={size} onChange={setSize} />
            <p className="text-[11px] text-muted-foreground text-center">
              {sizes.find((s) => s.value === size)?.dim}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-[hsl(var(--border-light))]" />

          {/* Reference images (img2img only) */}
          {mode === "img2img" && (
            <>
              <div className="space-y-3">
                <p className="section-header">参考图片</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
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
                      点击上传参考图片
                    </>
                  )}
                </button>

                {previewUrls.length > 0 && (
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
              placeholder="描述你想要的图片内容，越详细效果越好..."
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
              disabled={isPending || !prompt.trim()}
              className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1.5" />
                  生成图片
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
                  : "生成失败，请稍后重试"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Result area */}
      <div className="flex-1 pl-8 flex items-start justify-center">
        <div className="w-full max-w-2xl">
          {isPending ? (
            <SkeletonLoader />
          ) : result?.image_url ? (
            <div className="space-y-4 animate-fade-in">
              <img
                src={result.image_url}
                alt={result.prompt}
                className="w-full rounded-lg shadow-sm"
              />
              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-lg"
                  onClick={() => downloadGeneration(result.id, "image")}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  下载图片
                </Button>
                <Button
                  className="flex-1 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => generateMutation.reset()}
                >
                  <Wand2 className="h-4 w-4 mr-1.5" />
                  继续生成
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24">
              <EmptyIllustration />
              <p className="mt-4 text-[14px] font-medium text-foreground">
                等待生成
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                在左侧填写提示词，点击生成按钮创建图片
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
