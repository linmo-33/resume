"use client";

import { useEffect, useState } from "react";
import { useWebDAVStore } from "@/store/useWebDAVStore";
import { useResumeStore } from "@/store/useResumeStore";

export interface WebDAVInitState {
  isInitializing: boolean;
  stage: "connecting" | "syncing" | "completed" | "error" | "idle";
  progress: number;
  message: string;
  details?: string;
  error?: string;
}

/**
 * WebDAV 初始化 Hook
 * 在应用加载时自动初始化 WebDAV 同步功能
 */
export const useWebDAVInit = () => {
  const { isEnabled, isConnected, config, connect } = useWebDAVStore();
  const { initializeWebDAVSync } = useResumeStore();

  const [initState, setInitState] = useState<WebDAVInitState>({
    isInitializing: false,
    stage: "idle",
    progress: 0,
    message: "WebDAV 未启用",
    details: undefined,
    error: undefined,
  });

  // 检查是否已配置
  const isConfigured = config !== null;

  useEffect(() => {
    const initializeWebDAV = async () => {
      // 如果 WebDAV 未启用或未配置，跳过初始化
      if (!isEnabled || !isConfigured || !config) {
        setInitState({
          isInitializing: false,
          stage: "idle",
          progress: 0,
          message: "WebDAV 未启用或未配置",
        });
        return;
      }

      // 如果已连接，跳过初始化
      if (isConnected) {
        setInitState({
          isInitializing: false,
          stage: "completed",
          progress: 100,
          message: "WebDAV 连接成功",
        });
        return;
      }

      try {
        setInitState({
          isInitializing: true,
          stage: "connecting",
          progress: 10,
          message: "连接到 WebDAV 服务器...",
          details: `正在连接到 ${config.serverUrl}`,
        });

        console.log("开始 WebDAV 初始化...");

        // 1. 连接到 WebDAV 服务器
        await connect();

        setInitState({
          isInitializing: true,
          stage: "connecting",
          progress: 50,
          message: "WebDAV 连接成功",
          details: "正在准备同步...",
        });

        // 延迟一下，让用户看到连接成功的状态
        await new Promise((resolve) => setTimeout(resolve, 500));

        setInitState({
          isInitializing: true,
          stage: "syncing",
          progress: 80,
          message: "初始化简历同步...",
          details: "正在同步远程简历数据",
        });

        // 2. 初始化简历存储的 WebDAV 同步
        await initializeWebDAVSync();

        setInitState({
          isInitializing: true,
          stage: "syncing",
          progress: 95,
          message: "完成初始化...",
          details: "WebDAV 同步已准备就绪",
        });

        // 延迟一下，让用户看到完成状态
        await new Promise((resolve) => setTimeout(resolve, 300));

        setInitState({
          isInitializing: false,
          stage: "completed",
          progress: 100,
          message: "WebDAV 初始化完成",
          details: "所有简历数据已同步，可以开始使用",
        });

        console.log("WebDAV 初始化成功完成");

        // 2秒后隐藏完成状态
        setTimeout(() => {
          setInitState((prev) => ({
            ...prev,
            stage: "idle",
            message: "WebDAV 连接正常",
          }));
        }, 2000);
      } catch (error) {
        console.error("WebDAV 初始化失败:", error);

        const errorMessage =
          error instanceof Error ? error.message : "未知错误";

        setInitState({
          isInitializing: false,
          stage: "error",
          progress: 0,
          message: "WebDAV 初始化失败",
          details: `错误信息: ${errorMessage}`,
          error: errorMessage,
        });

        // 10秒后重置错误状态
        setTimeout(() => {
          setInitState((prev) => ({
            ...prev,
            stage: "idle",
            message: "WebDAV 连接失败",
            details: "可以在设置中重新配置 WebDAV 连接",
            error: undefined,
          }));
        }, 10000);
      }
    };

    // 延迟初始化，确保组件挂载完成
    const timer = setTimeout(initializeWebDAV, 100);

    return () => clearTimeout(timer);
  }, [
    isEnabled,
    isConfigured,
    isConnected,
    config,
    connect,
    initializeWebDAVSync,
  ]);

  return {
    isEnabled,
    isConnected,
    isConfigured,
    initState,
    // 重试初始化
    retry: () => {
      if (isEnabled && isConfigured && config && !isConnected) {
        setInitState({
          isInitializing: false,
          stage: "idle",
          progress: 0,
          message: "准备重试...",
        });
      }
    },
  };
};

export default useWebDAVInit;
