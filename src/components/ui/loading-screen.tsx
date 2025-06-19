"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Cloud, Wifi, CheckCircle } from "lucide-react";

interface LoadingScreenProps {
  isVisible: boolean;
  stage: "connecting" | "syncing" | "completed" | "error" | "idle";
  message?: string;
  progress?: number;
  details?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isVisible,
  stage,
  message,
  progress = 0,
  details,
}) => {
  if (!isVisible) return null;

  const getStageInfo = () => {
    switch (stage) {
      case "connecting":
        return {
          icon: <Wifi className="h-6 w-6 text-blue-500" />,
          title: "连接云端服务",
          description: message || "正在连接到WebDAV服务器...",
          color: "blue",
        };
      case "syncing":
        return {
          icon: <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />,
          title: "同步数据",
          description: message || "正在同步简历数据...",
          color: "blue",
        };
      case "completed":
        return {
          icon: <CheckCircle className="h-6 w-6 text-green-500" />,
          title: "同步完成",
          description: message || "数据同步成功！",
          color: "green",
        };
      case "error":
        return {
          icon: <Cloud className="h-6 w-6 text-red-500" />,
          title: "连接失败",
          description: message || "无法连接到云端服务",
          color: "red",
        };
      case "idle":
        return {
          icon: <Cloud className="h-6 w-6 text-gray-500" />,
          title: "待机",
          description: message || "WebDAV连接待机中",
          color: "gray",
        };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-96 p-6 bg-white/95 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          {/* 图标和标题 */}
          <div className="flex items-center space-x-3">
            {stageInfo.icon}
            <div>
              <h3 className="font-semibold text-lg">{stageInfo.title}</h3>
              <Badge
                variant={
                  stageInfo.color === "red"
                    ? "destructive"
                    : stageInfo.color === "green"
                    ? "default"
                    : "secondary"
                }
                className="mt-1"
              >
                {stage === "connecting" && "连接中"}
                {stage === "syncing" && "同步中"}
                {stage === "completed" && "已完成"}
                {stage === "error" && "错误"}
                {stage === "idle" && "待机"}
              </Badge>
            </div>
          </div>

          {/* 描述 */}
          <p className="text-sm text-muted-foreground text-center">
            {stageInfo.description}
          </p>

          {/* 进度条（仅在同步阶段显示） */}
          {stage === "syncing" && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.toFixed(0)}% 完成
              </p>
            </div>
          )}

          {/* 详细信息 */}
          {details && (
            <div className="w-full">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs text-muted-foreground">{details}</p>
              </div>
            </div>
          )}

          {/* 加载动画 */}
          {stage !== "completed" && stage !== "error" && (
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LoadingScreen;
 