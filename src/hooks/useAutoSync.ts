import { useEffect, useRef } from "react";
import { useResumeStore } from "@/store/useResumeStore";
import { useWebDAVStore } from "@/store/useWebDAVStore";

// 同步间隔（毫秒）
const SYNC_INTERVAL = 5 * 60 * 1000; // 5分钟

/**
 * 自动同步钩子 - 定时同步和页面卸载前同步
 */
export function useAutoSync() {
  const { activeResume, syncToWebDAV } = useResumeStore();
  const { isEnabled, isConnected } = useWebDAVStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<Date | null>(null);

  // 执行同步
  const performSync = async () => {
    if (!isEnabled || !isConnected || !activeResume) return;

    try {
      console.log(`执行定时同步: ${new Date().toLocaleTimeString()}`);
      await syncToWebDAV(activeResume.id);
      lastSyncRef.current = new Date();
    } catch (error) {
      console.error("自动同步失败:", error);
    }
  };

  // 设置定时器
  useEffect(() => {
    // 只有启用WebDAV且连接成功时才设置定时器
    if (isEnabled && isConnected) {
      // 清除旧定时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // 设置新定时器
      timerRef.current = setInterval(performSync, SYNC_INTERVAL);
      console.log("已设置定时同步，间隔:", SYNC_INTERVAL / 1000, "秒");

      // 页面卸载前同步
      const handleBeforeUnload = () => {
        if (activeResume) {
          console.log("页面卸载前执行同步");
          syncToWebDAV(activeResume.id);
        }
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isEnabled, isConnected, activeResume, syncToWebDAV]);

  return {
    lastSync: lastSyncRef.current,
    manualSync: performSync,
  };
}

export default useAutoSync;
