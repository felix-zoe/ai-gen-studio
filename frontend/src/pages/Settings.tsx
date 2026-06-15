import { useState } from "react";
import { Loader2, Check, X, Eye, EyeOff, AlertTriangle, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { KeyTestResponse, KeysStatusResponse } from "@/types/generation";

const PROVIDER_LABELS: Record<string, string> = {
  sensenova: "SenseNova (商汤)",
  agnes: "Agnes Image/Video",
};

export default function Settings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
      setError(null);
    },
    onError: (err: Error) => {
      setError(`保存失败：${err.message}`);
    },
  });

  // Delete key
  const deleteMutation = useMutation({
    mutationFn: (provider: string) => api.delete(`/keys/${provider}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      setDeleteTarget(null);
      setError(null);
    },
    onError: (err: Error) => {
      setError(`删除失败：${err.message}`);
      setDeleteTarget(null);
    },
  });

  // Test key
  const testMutation = useMutation({
    mutationFn: (provider: string) =>
      api.post<KeyTestResponse>(`/keys/${provider}/test`).then((r) => r.data),
    onError: (err: Error) => {
      setError(`测试失败：${err.message}`);
    },
  });

  const handleStartEdit = (provider: string) => {
    setEditing(provider);
    setKeyValue("");
    setShowKey(false);
    setError(null);
  };

  const handleSave = (provider: string) => {
    if (!keyValue.trim()) return;
    saveMutation.mutate({ provider, key: keyValue.trim() });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget);
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
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setError(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
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
                        disabled={testMutation.isPending && testMutation.variables === keyStatus.provider}
                      >
                        {testMutation.isPending && testMutation.variables === keyStatus.provider ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        测试
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(keyStatus.provider)}
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

      {/* ── Delete Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              <p>确定要删除 <span className="font-medium text-foreground">{PROVIDER_LABELS[deleteTarget] || deleteTarget}</span> 的 API Key 吗？此操作不可撤销。</p>
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
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
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