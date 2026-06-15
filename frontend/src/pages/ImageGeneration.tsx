import { useState, useRef, useEffect } from "react";
import { Loader2, Upload, Wand2, Download, X } from "lucide-react";
import { useGenerateImage, useUploadImage } from "@/hooks/useGeneration";
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

const SENSENOVA_SIZES = [
  { ratio: "1:1", dim: "2048×2048", value: "2048x2048" },
  { ratio: "2:3", dim: "1664×2496", value: "1664x2496" },
  { ratio: "3:2", dim: "2496×1664", value: "2496x1664" },
  { ratio: "3:4", dim: "1760×2368", value: "1760x2368" },
  { ratio: "4:3", dim: "2368×1760", value: "2368x1760" },
  { ratio: "4:5", dim: "1824×2272", value: "1824x2272" },
  { ratio: "5:4", dim: "2272×1824", value: "2272x1824" },
  { ratio: "16:9", dim: "2752×1536", value: "2752x1536" },
  { ratio: "9:16", dim: "1536×2752", value: "1536x2752" },
  { ratio: "21:9", dim: "3072×1376", value: "3072x1376" },
  { ratio: "9:21", dim: "1344×3136", value: "1344x3136" },
];

const COMMON_SIZES = [
  { ratio: "1:1", dim: "1024×1024", value: "1024x1024" },
  { ratio: "1:1", dim: "2048×2048", value: "2048x2048" },
  { ratio: "3:2", dim: "1920×1280", value: "1920x1280" },
  { ratio: "2:3", dim: "1280×1920", value: "1280x1920" },
  { ratio: "4:3", dim: "1600×1200", value: "1600x1200" },
  { ratio: "3:4", dim: "1200×1600", value: "1200x1600" },
  { ratio: "16:9", dim: "1280×720", value: "1280x720" },
  { ratio: "9:16", dim: "720×1280", value: "720x1280" },
];

export default function ImageGeneration() {
  const [provider, setProvider] = useState("sensenova");
  const [mode, setMode] = useState("text2img");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("2048x2048");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const sizes = provider === "sensenova" ? SENSENOVA_SIZES : COMMON_SIZES;

  // Auto-switch provider/mode when the other changes to an invalid combo
  useEffect(() => {
    if (mode === "img2img") {
      setProvider("agnes");
    }
  }, [mode]);

  useEffect(() => {
    if (provider === "sensenova" && mode === "img2img") {
      setMode("text2img");
    }
  }, [provider]);

  // Reset size when provider changes and current size isn't valid for the new provider
  useEffect(() => {
    const validSizes = provider === "sensenova" ? SENSENOVA_SIZES : COMMON_SIZES;
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
      setImageUrls((prev) => [...prev, ...newUrls]);
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    } catch {
      // error handled by mutation
    }
    // Reset so the same file(s) can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
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
        ? { image_urls: imageUrls }
        : {}),
    });
  };

  const resetForm = () => {
    setPrompt("");
    setImageUrls([]);
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const result = generateMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">图片生成</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>参数设置</CardTitle>
            <CardDescription>选择模型和输入提示词</CardDescription>
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
                  <SelectItem value="sensenova">sensenova-u1-fast</SelectItem>
                  <SelectItem value="agnes">agnes-image-2.1-flash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode */}
            <div className="space-y-2">
              <Label>生成模式</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
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

            {/* Size */}
            <div className="space-y-2">
              <Label>画面尺寸</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.ratio} ({s.dim})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference images (img2img only) */}
            {mode === "img2img" && (
              <div className="space-y-2">
                <Label>参考图片</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
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

                {/* Preview grid */}
                {previewUrls.length > 0 && (
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
                placeholder="描述你想要的图片..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !prompt.trim()}
                className="flex-1"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    生成
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                重置
              </Button>
            </div>

            {generateMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : "生成失败"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle>生成结果</CardTitle>
            <CardDescription>生成的图片将显示在这里</CardDescription>
          </CardHeader>
          <CardContent>
            {generateMutation.isPending ? (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">正在生成...</p>
                </div>
              </div>
            ) : result?.image_url ? (
              <div className="space-y-3">
                <img
                  src={result.image_url}
                  alt={result.prompt}
                  className="w-full rounded-lg"
                />
                <div className="flex gap-2">
                  <a
                    href={result.image_url!}
                    download
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="h-4 w-4" />
                      下载
                    </Button>
                  </a>
                  <Button size="sm" onClick={() => generateMutation.reset()} className="flex-1">
                    继续生成
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed">
                <div className="text-center text-muted-foreground">
                  <Upload className="mx-auto h-8 w-8" />
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