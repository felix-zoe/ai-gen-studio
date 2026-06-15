import { useState } from "react";
import {
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Trash2,
  Key,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
        <h2 className="text-[18px] font-semibold text-foreground tracking-[-0.01em]">
          API Key 管理
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          配置上游 AI 模型的 API Key。密钥使用 AES-256-GCM 加密存储。
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border-l-[3px] border-destructive bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <span className="flex-1 text-[13px] text-destructive">
            {error}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => setError(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {data?.keys.map((keyStatus) => (
            <Card
              key={keyStatus.provider}
              className="border-[hsl(var(--border-light))]"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--surface-1))]">
                      <Key className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-medium text-foreground">
                        {PROVIDER_LABELS[keyStatus.provider] ||
                          keyStatus.provider}
                      </h3>
                      {keyStatus.configured && keyStatus.masked_key ? (
                        <p className="text-[12px] text-muted-foreground font-mono">
                          {keyStatus.masked_key}
                        </p>
                      ) : (
                        <p className="text-[12px] text-muted-foreground">
                          未配置
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      keyStatus.configured ? "default" : "secondary"
                    }
                    className={
                      keyStatus.configured
                        ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-0"
                        : ""
                    }
                  >
                    {keyStatus.configured ? "已配置" : "未配置"}
                  </Badge>
                </div>

                {/* Edit form */}
                {editing === keyStatus.provider && (
                  <div className="mt-4 space-y-3 border-t border-[hsl(var(--border-light))] pt-4">
                    <div className="space-y-2">
                      <Label className="text-[13px] font-medium">
                        API Key
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type={showKey ? "text" : "password"}
                            placeholder="输入 API Key..."
                            value={keyValue}
                            onChange={(e) => setKeyValue(e.target.value)}
                            className="pl-9 h-10"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowKey(!showKey)}
                          >
                            {showKey ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => handleSave(keyStatus.provider)}
                          disabled={
                            saveMutation.isPending || !keyValue.trim()
                          }
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
                          className="h-10"
                          onClick={() => setEditing(null)}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      handleStartEdit(keyStatus.provider)
                    }
                  >
                    {keyStatus.configured ? "修改" : "配置"}
                  </Button>
                  {keyStatus.configured && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() =>
                          testMutation.mutate(keyStatus.provider)
                        }
                        disabled={
                          testMutation.isPending &&
                          testMutation.variables ===
                            keyStatus.provider
                        }
                      >
                        {testMutation.isPending &&
                        testMutation.variables ===
                          keyStatus.provider ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        测试
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setDeleteTarget(keyStatus.provider)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </>
                  )}
                </div>

                {/* Test result - toast style */}
                {testMutation.data &&
                  testMutation.variables ===
                    keyStatus.provider && (
                    <div
                      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] ${
                        testMutation.data.ok
                          ? "border-l-[3px] border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)] text-[hsl(var(--success))]"
                          : "border-l-[3px] border-destructive bg-destructive/5 text-destructive"
                      }`}
                    >
                      {testMutation.data.ok ? (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {testMutation.data.message}
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
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
              <p>
                确定要删除{" "}
                <span className="font-medium text-foreground">
                  {PROVIDER_LABELS[deleteTarget] || deleteTarget}
                </span>{" "}
                的 API Key 吗？此操作不可撤销。
              </p>
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
                  <>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    确认删除
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
