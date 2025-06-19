"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWebDAVStore } from "@/store/useWebDAVStore";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  mode?: "compact" | "detailed" | "floating";
  className?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  mode = "compact",
  className = "",
}) => {
  const { isEnabled, isConnected, syncStatus, forceSync } = useWebDAVStore();

  const getSyncStatusInfo = () => {
    if (!isEnabled) {
      return {
        icon: <CloudOff className="h-4 w-4 text-gray-500" />,
        text: "WebDAV 未启用",
        color: "gray",
        description: "在设置中启用 WebDAV 同步",
      };
    }

    if (!isConnected) {
      return {
        icon: <CloudOff className="h-4 w-4 text-red-500" />,
        text: "未连接",
        color: "red",
        description: "WebDAV 连接失败",
      };
    }

    switch (syncStatus.status) {
      case "syncing":
        return {
          icon: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
          text: "同步中",
          color: "blue",
          description: "正在同步简历数据",
        };
      case "synced":
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          text: "已同步",
          color: "green",
          description: syncStatus.lastSync
            ? `最后同步: ${syncStatus.lastSync.toLocaleTimeString()}`
            : "同步成功",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
          text: "同步失败",
          color: "red",
          description: syncStatus.error || "同步时发生错误",
        };
      default:
        return {
          icon: <Cloud className="h-4 w-4 text-blue-500" />,
          text: "已连接",
          color: "blue",
          description: "WebDAV 连接正常",
        };
    }
  };

  const statusInfo = getSyncStatusInfo();

  const handleForceSync = async () => {
    try {
      await forceSync();
    } catch (error) {
      console.error("手动同步失败:", error);
    }
  };

  if (mode === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center space-x-2 ${className}`}>
              {statusInfo.icon}
              <Badge
                variant={
                  statusInfo.color === "red"
                    ? "destructive"
                    : statusInfo.color === "green"
                    ? "default"
                    : "secondary"
                }
              >
                {statusInfo.text}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusInfo.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (mode === "detailed") {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {statusInfo.icon}
              <div>
                <div className="font-medium">{statusInfo.text}</div>
                <div className="text-sm text-muted-foreground">
                  {statusInfo.description}
                </div>
              </div>
            </div>
            {isConnected && syncStatus.status !== "syncing" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceSync}
                className="flex items-center space-x-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>同步</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "floating") {
    return (
      <div
        className={`fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg p-3 ${className}`}
      >
        <div className="flex items-center space-x-2">
          {statusInfo.icon}
          <span className="text-sm font-medium">{statusInfo.text}</span>
        </div>
      </div>
    );
  }

  return null;
};

export default SyncStatus;
