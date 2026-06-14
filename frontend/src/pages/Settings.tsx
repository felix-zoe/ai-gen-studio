import { useState } from "react";
import { Loader2, Check, X, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { KeysStatusResponse } from "@/types/generation";

const PROVIDER_LABELS: Record<string, string> = {
  sensenova: "SenseNova (商汤)",
  agnes: "Agnes Image/Video",
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Fetch keys
  const { data, isLoading } = useQuery({
    queryKey: ["keys"],
    queryFn: () =>
      api.get<KeysStatusResponse>("/keys").then((r) => r.data),
  });

  // Save key
  const saveMutation = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      api.put(`/keys/${provider}`, { key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      setEditing(null);
      setKeyValue("");
    },
  });

  // Delete key
  const deleteMutation = useMutation({
    mutationFn: (provider: string) => api.delete(`/keys/${provider}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
    },
  });

  // Test key
  const testMutation = useMutation({
    mutationFn: (provider: string) =>
      api.post(`/keys/${provider}/test`).then((r) => r.data),
  });

  const handleStartEdit = (provider: string) => {
    setEditing(provider);
    setKeyValue("");
    setShowKey(false);
  };

  const handleSave = (provider: string) => {
    if (!keyValue.trim()) return;
    saveMutation.mutate({ provider, key: keyValue.trim() });
  };

  const handleDelete = (provider: string) => {
    if (window.confirm(`确定删除 ${PROVIDER_LABELS[provider]} 的 API Key 吗？`)) {
      deleteMutation.mutate(provider);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground">管理 API Key 和账号设置</p>
      </div>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Key 管理</CardTitle>
          <CardDescription>
            配置上游 AI 模型的 API Key。密钥将使用 AES-256-GCM 加密存储。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            data?.keys.map((keyStatus) => (
              <div key={keyStatus.provider} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">
                      {PROVIDER_LABELS[keyStatus.provider] || keyStatus.provider}
                    </h3>
                    {keyStatus.configured && keyStatus.masked_key ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        已配置：{keyStatus.masked_key}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        未配置
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={keyStatus.configured ? "default" : "secondary"}
                  >
                    {keyStatus.configured ? "已配置" : "未配置"}
                  </Badge>
                </div>

                {/* Edit form */}
                {editing === keyStatus.provider && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showKey ? "text" : "password"}
                            placeholder="输入 API Key..."
                            value={keyValue}
                            onChange={(e) => setKeyValue(e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={() => setShowKey(!showKey)}
                          >
                            {showKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSave(keyStatus.provider)}
                          disabled={saveMutation.isPending || !keyValue.trim()}
                        >
                          {saveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          保存
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(null)}
                        >
                          <X className="h-4 w-4" />
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStartEdit(keyStatus.provider)}
                  >
                    修改
                  </Button>
                  {keyStatus.configured && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testMutation.mutate(keyStatus.provider)}
                        disabled={testMutation.isPending}
                      >
                        {testMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        测试
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(keyStatus.provider)}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>

                {/* Test result */}
                {testMutation.data &&
                  testMutation.variables === keyStatus.provider && (
                    <div
                      className={`mt-2 rounded-md p-2 text-sm ${
                        testMutation.data.ok
                          ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {testMutation.data.message}
                    </div>
                  )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}