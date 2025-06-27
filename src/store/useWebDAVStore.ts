import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  webdavClient,
  WebDAVConfig,
  SyncStrategy,
  SyncStatus,
} from "@/utils/webdav";
import { ResumeData } from "@/types/resume";

// 确保store中的strategy类型与webdav.ts中的一致
interface WebDAVStore {
  // 配置相关
  config: WebDAVConfig | null;
  isConnected: boolean;
  isEnabled: boolean; // 是否启用 WebDAV 同步

  // 同步状态
  syncStatus: SyncStatus;
  strategy: SyncStrategy;

  // 操作方法
  setConfig: (config: WebDAVConfig) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  testConnection: (config: WebDAVConfig) => Promise<boolean>;
  updateStrategy: (strategy: Partial<SyncStrategy>) => void;
  enableSync: (enabled: boolean) => void;

  // 同步操作
  syncResume: (resumeId: string, resumeData: any) => Promise<void>;
  syncAllResumes: (resumes: Record<string, any>) => Promise<void>;
  loadRemoteResumes: () => Promise<Record<string, any>>;
  uploadResume: (resumeData: ResumeData) => Promise<void>;

  // 内部辅助方法
  startStatusListener: () => void;
  getLocalResumeData: () => ResumeData[];
  updateLocalResume: (data: ResumeData) => void;

  // 新增的代理客户端状态
  hasClient: boolean;
  hasConfig: boolean;
}

export const useWebDAVStore = create<WebDAVStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      config: null,
      isConnected: false,
      isEnabled: false,
      syncStatus: { status: "idle" },
      strategy: {
        autoSync: true,
        syncInterval: 30,
      },

      // 新增的代理客户端状态
      hasClient: false,
      hasConfig: false,

      // 设置配置
      setConfig: (config: WebDAVConfig) => {
        set({ config });
      },

      // 连接到 WebDAV 服务器
      connect: async (): Promise<boolean> => {
        if (!get().config) return false;

        set({ syncStatus: { status: "syncing" } });

        try {
          const config = get().config!;
          // 使用支持代理自动切换的 webdavClient 替代直接的 WebDAV 客户端
          const connected = await webdavClient.initialize(config);

          if (connected) {
            set({
              isConnected: true,
              syncStatus: { status: "synced", lastSync: new Date() },
              hasClient: webdavClient.isInitialized(),
              hasConfig: !!webdavClient.config,
            });
            return true;
          } else {
            throw new Error("连接失败");
          }
        } catch (error) {
          set({
            isConnected: false,
            syncStatus: {
              status: "error",
              error: error instanceof Error ? error.message : "连接失败",
            },
          });
          return false;
        }
      },

      // 断开连接
      disconnect: () => {
        webdavClient.disconnect();
        set({
          isConnected: false,
          hasClient: false,
          syncStatus: { status: "idle" },
        });
      },

      // 测试连接
      testConnection: async (config: WebDAVConfig): Promise<boolean> => {
        try {
          // 使用代理模式测试连接
          const params = new URLSearchParams({
            serverUrl: config.serverUrl,
            username: config.username,
            password: config.password,
          });

          const response = await fetch(
            `/api/webdav/test-connection?${params}`,
            {
              method: "GET",
            }
          );

          const result = await response.json();
          return result.success;
        } catch (error) {
          console.error("测试连接失败:", error);
          return false;
        }
      },

      // 更新同步策略
      updateStrategy: (newStrategy: Partial<SyncStrategy>) => {
        set((state) => ({
          strategy: { ...state.strategy, ...newStrategy },
        }));
      },

      // 启用/禁用同步
      enableSync: (enabled: boolean) => {
        set({ isEnabled: enabled });
        if (!enabled) {
          get().disconnect();
        }
      },

      // 同步单个简历
      syncResume: async (resumeId: string, resumeData: any): Promise<void> => {
        if (!webdavClient.config) return;

        try {
          await webdavClient.uploadResume(resumeData);
          set({
            syncStatus: {
              status: "synced",
              lastSync: new Date(),
            },
          });
        } catch (error) {
          set({
            syncStatus: {
              status: "error",
              error: error instanceof Error ? error.message : "同步失败",
            },
          });
        }
      },

      // 同步所有简历
      syncAllResumes: async (resumes: Record<string, any>): Promise<void> => {
        for (const [id, data] of Object.entries(resumes)) {
          await get().syncResume(id, data);
        }
      },

      // 加载远程简历
      loadRemoteResumes: async (): Promise<Record<string, any>> => {
        if (!webdavClient.config) return {};

        try {
          return await webdavClient.getAllRemoteResumes();
        } catch (error) {
          console.error("加载远程简历失败:", error);
          return {};
        }
      },

      // 上传简历
      uploadResume: async (resumeData: ResumeData): Promise<void> => {
        if (!webdavClient.config) return;

        try {
          await webdavClient.uploadResume(resumeData);
        } catch (error) {
          throw new Error(
            `上传简历失败: ${
              error instanceof Error ? error.message : "未知错误"
            }`
          );
        }
      },

      // 启动状态监听器
      startStatusListener: () => {
        // 监听网络状态变化
        if (typeof window !== "undefined") {
          const handleOnline = () => {
            if (get().isEnabled && !get().isConnected) {
              get().connect();
            }
          };

          const handleOffline = () => {
            set({
              syncStatus: {
                ...get().syncStatus,
                status: "error",
                error: "网络连接已断开",
              },
            });
          };

          window.addEventListener("online", handleOnline);
          window.addEventListener("offline", handleOffline);

          // 清理函数
          return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
          };
        }
      },

      // 获取本地简历数据的辅助方法
      getLocalResumeData: (): ResumeData[] => {
        try {
          // 与useResumeStore集成，获取当前存储的简历数据
          if (typeof window !== "undefined") {
            // 从zustand的持久化存储中获取数据
            const resumeStorage = localStorage.getItem("resume-storage");
            if (resumeStorage) {
              const data = JSON.parse(resumeStorage);
              if (data.state && data.state.resumes) {
                return Object.values(data.state.resumes) as ResumeData[];
              }
            }
          }
          return [];
        } catch {
          return [];
        }
      },

      // 更新本地简历数据的辅助方法
      updateLocalResume: (data: ResumeData) => {
        try {
          // 与useResumeStore集成，通过导入的store更新数据
          if (typeof window !== "undefined") {
            // 更新zustand持久化存储
            const resumeStorage = localStorage.getItem("resume-storage");
            if (resumeStorage) {
              const storage = JSON.parse(resumeStorage);
              if (storage.state && storage.state.resumes) {
                storage.state.resumes[data.id] = data;
                localStorage.setItem("resume-storage", JSON.stringify(storage));
              }
            }
          }
        } catch (error) {
          console.error("更新本地简历失败:", error);
        }
      },
    }),
    {
      name: "webdav-store",
      // 排除敏感信息
      partialize: (state) => ({
        config: state.config,
        isEnabled: state.isEnabled,
        strategy: state.strategy,
      }),
    }
  )
);
