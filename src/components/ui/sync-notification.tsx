"use client";

import React, { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Cloud,
  CloudOff,
  RefreshCw,
  X,
} from "lucide-react";
import { useWebDAVStore } from "@/store/useWebDAVStore";
import { useResumeStore } from "@/store/useResumeStore";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface SyncNotificationProps {
  className?: string;
  autoHide?: boolean;
  hideDelay?: number;
}

export const SyncNotification: React.FC<SyncNotificationProps> = ({
  className = "",
  autoHide = true,
  hideDelay = 3000,
}) => {
  const { syncStatus, isEnabled, isConnected } = useWebDAVStore();
  const { syncToWebDAV } = useResumeStore();
  const [isVisible, setIsVisible] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(
    null
  );

  // 根据同步状态决定是否显示通知
  useEffect(() => {
    if (!isEnabled) {
      setIsVisible(false);
      return;
    }

    if (syncStatus.status === "syncing") {
      setIsVisible(true);
      setLastNotificationTime(new Date());
    } else if (syncStatus.status === "error") {
      setIsVisible(true);
      setLastNotificationTime(new Date());
    } else if (syncStatus.status === "synced" && syncStatus.lastSync) {
      setIsVisible(true);
      setLastNotificationTime(new Date());

      // 自动隐藏成功通知
      if (autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, hideDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [syncStatus, isEnabled, autoHide, hideDelay]);

  const handleManualSync = async () => {
    try {
      await syncToWebDAV();
    } catch (error) {
      console.error("手动同步失败:", error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case "syncing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "synced":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return isConnected ? (
          <Cloud className="h-4 w-4 text-gray-500" />
        ) : (
          <CloudOff className="h-4 w-4 text-gray-400" />
        );
    }
  };

  const getStatusText = () => {
    switch (syncStatus.status) {
      case "syncing":
        return "正在同步到云端...";
      case "synced":
        return syncStatus.lastSync
          ? `已同步 - ${formatDistanceToNow(syncStatus.lastSync, {
              addSuffix: true,
              locale: zhCN,
            })}`
          : "已同步到云端";
      case "error":
        return `同步失败: ${syncStatus.error || "未知错误"}`;
      default:
        return isConnected ? "云端连接正常" : "未连接到云端";
    }
  };

  const getStatusVariant = () => {
    switch (syncStatus.status) {
      case "syncing":
        return "default";
      case "synced":
        return "default"; // success variant 不被支持，使用 default
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // 如果未启用WebDAV或不可见，不显示组件
  if (!isEnabled || !isVisible) {
    return null;
  }

  return (
    <Card className={`fixed bottom-4 right-4 z-50 w-80 shadow-lg ${className}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 flex-1">
            {getStatusIcon()}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">WebDAV 同步</span>
                <Badge variant={getStatusVariant()}>
                  {syncStatus.status === "syncing" && "同步中"}
                  {syncStatus.status === "synced" && "已同步"}
                  {syncStatus.status === "error" && "失败"}
                  {syncStatus.status === "idle" &&
                    (isConnected ? "已连接" : "未连接")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {getStatusText()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 ml-2">
            {syncStatus.status === "error" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualSync}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {syncStatus.status === "error" && syncStatus.error && (
          <Alert className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {syncStatus.error}
              <br />
              <Button
                variant="link"
                size="sm"
                onClick={handleManualSync}
                className="h-auto p-0 text-xs mt-1"
              >
                点击重试
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
};

export default SyncNotification;
