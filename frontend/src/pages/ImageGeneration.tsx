import { useState, useRef } from "react";
import { Loader2, ImagePlus, Wand2 } from "lucide-react";
import { useGenerateImage, useUploadImage } from "@/hooks/useGeneration";
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

const SIZES = [
  { label: "1024×1024 (方形)", value: "1024x1024" },
  { label: "1152×768 (16:9)", value: "1152x768" },
  { label: "768×1152 (9:16)", value: "768x1152" },
  { label: "2048×2048 (方形)", value: "2048x2048" },
  { label: "2304×1536 (16:9)", value: "2304x1536" },
  { label: "1536×2304 (9:16)", value: "1536x2304" },
];

export default function ImageGeneration() {
  const [provider, setProvider] = useState("sensenova");
  const [mode, setMode] = useState("text2img");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const generateMutation = useGenerateImage();
  const uploadMutation = useUploadImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMutation.mutateAsync(file);
      setImageUrl(result.url);
      setPreviewUrl(result.url);
    } catch {
      // error handled by mutation
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateMutation.mutate({
      provider,
      mode,
      prompt: prompt.trim(),
      size,
      ...(mode === "img2img" && imageUrl ? { image_url: imageUrl } : {}),
    });
  };

  const resetForm = () => {
    setPrompt("");
    setImageUrl("");
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const result = generateMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">图片生成</h1>
        <p className="text-muted-foreground">使用 AI 生成图片</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>参数设置</CardTitle>
            <CardDescription>选择模型和输入提示词</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider */}
            <div className="space-y-2">
              <Label>模型提供商</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensenova">SenseNova (商汤)</SelectItem>
                  <SelectItem value="agnes">Agnes Image 2.1</SelectItem>
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
                  <SelectItem value="img2img">图生图</SelectItem>
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
                  {SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference image (img2img only) */}
            {mode === "img2img" && (
              <div className="space-y-2">
                <Label>参考图片</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                </div>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(result.image_url!, "_blank")}
                    className="flex-1"
                  >
                    查看原图
                  </Button>
                  <Button size="sm" onClick={resetForm} className="flex-1">
                    继续生成
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed">
                <div className="text-center text-muted-foreground">
                  <ImagePlus className="mx-auto h-8 w-8" />
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