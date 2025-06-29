"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Cloud,
  Archive,
} from "lucide-react";
import { useWebDAVStore } from "@/store/useWebDAVStore";
import {
  WebDAVBatchOperations,
  BatchSyncResult,
  BatchImportResult,
} from "@/utils/webdav-batch";

interface BatchOperationsPanelProps {
  className?: string;
}

export const BatchOperationsPanel: React.FC<BatchOperationsPanelProps> = ({
  className = "",
}) => {
  const { isEnabled, isConnected } = useWebDAVStore();
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    type: "sync" | "import" | "auto";
    data: any;
  } | null>(null);

  const isAvailable = isEnabled && isConnected;

  const runOperation = async (
    operationType: string,
    operationFn: () => Promise<any>
  ) => {
    if (!isAvailable) return;

    setIsLoading(true);
    setOperation(operationType);
    setProgress(0);
    setResult(null);

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const data = await operationFn();

      clearInterval(progressInterval);
      setProgress(100);

      setResult({
        type: operationType as any,
        data,
      });
    } catch (error) {
      console.error(`${operationType} 操作失败:`, error);
      setResult({
        type: operationType as any,
        data: {
          error: error instanceof Error ? error.message : "操作失败",
        },
      });
    } finally {
      setIsLoading(false);
      setOperation(null);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleSyncAll = () => {
    runOperation("sync", () => WebDAVBatchOperations.syncAllToWebDAV());
  };

  const handleImportAll = () => {
    runOperation("import", () => WebDAVBatchOperations.importAllFromWebDAV());
  };

  const handleAutoSync = () => {
    runOperation("auto", () => WebDAVBatchOperations.autoSync());
  };

  const renderResult = () => {
    if (!result) return null;

    const { type, data } = result;

    if (data.error) {
      return (
        <Alert className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>操作失败：</strong> {data.error}
          </AlertDescription>
        </Alert>
      );
    }

    switch (type) {
      case "sync":
        const syncResult = data as BatchSyncResult;
        return (
          <Card className="mt-4 border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-800 flex items-center">
                <Upload className="h-4 w-4 mr-2" />
                批量上传结果
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {syncResult.success}
                  </div>
                  <div className="text-xs text-muted-foreground">成功</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {syncResult.failed}
                  </div>
                  <div className="text-xs text-muted-foreground">失败</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">
                    {syncResult.total}
                  </div>
                  <div className="text-xs text-muted-foreground">总计</div>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <div className="mt-3">
                  <Separator className="mb-2" />
                  <div className="text-xs text-red-600">
                    <strong>错误详情：</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {syncResult.errors.map((error, index) => (
                        <li key={index}>
                          {error.title}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "import":
        const importResult = data as BatchImportResult;
        return (
          <Card className="mt-4 border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-800 flex items-center">
                <Download className="h-4 w-4 mr-2" />
                批量导入结果
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {importResult.imported}
                  </div>
                  <div className="text-xs text-muted-foreground">已导入</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {importResult.skipped}
                  </div>
                  <div className="text-xs text-muted-foreground">已跳过</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">
                    {importResult.total}
                  </div>
                  <div className="text-xs text-muted-foreground">总计</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "auto":
        const autoResult = data as {
          uploaded: BatchSyncResult;
          downloaded: BatchImportResult;
        };
        return (
          <Card className="mt-4 border-purple-200 bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-purple-800 flex items-center">
                <RefreshCw className="h-4 w-4 mr-2" />
                自动同步结果
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">上传</span>
                <Badge variant="outline">
                  {autoResult.uploaded.success}/{autoResult.uploaded.total}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">下载</span>
                <Badge variant="outline">
                  {autoResult.downloaded.imported}/{autoResult.downloaded.total}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Cloud className="h-5 w-5 mr-2" />
          批量操作
          {isAvailable ? (
            <Badge variant="default" className="ml-2">
              已连接
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-2">
              未连接
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAvailable && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              请先启用并配置 WebDAV 连接后再使用批量操作功能
            </AlertDescription>
          </Alert>
        )}

        {/* 进度指示器 */}
        {isLoading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{operation}</span>
              <span className="text-sm text-muted-foreground">
                {progress.toFixed(0)}%
              </span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={!isAvailable || isLoading}
            className="flex items-center"
          >
            {isLoading && operation === "sync" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            全部上传
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleImportAll}
            disabled={!isAvailable || isLoading}
            className="flex items-center"
          >
            {isLoading && operation === "import" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            全部下载
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoSync}
            disabled={!isAvailable || isLoading}
            className="flex items-center"
          >
            {isLoading && operation === "auto" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            自动同步
          </Button>
        </div>

        <Separator />

        {/* 结果显示 */}
        {renderResult()}
      </CardContent>
    </Card>
  );
};

export default BatchOperationsPanel;
