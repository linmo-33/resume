import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  webdavClient,
  WebDAVConfig,
  SyncStrategy,
  SyncStatus,
} from "@/utils/webdav";
import { createClient, WebDAVClient } from "webdav";
import { ResumeData } from "@/types/resume";
import { WebDAVSyncDetector, SyncScheduler } from "@/utils/webdav-sync";

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

  // 新增的简化同步方法
  enableSmartSync: (enabled: boolean) => void;
  detectChanges: (resumeId?: string) => Promise<{
    hasChanges: boolean;
    summary: string;
  }>;
  forceSync: () => Promise<boolean>;
  autoSyncOnLoad: () => Promise<boolean>;

  // 变更处理方法
  handleChangesDetected: (changes: any) => void;
  generateChangesSummary: (changes: Record<string, any>) => string;
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

      // 内部状态
      client: null,
      syncDetector: null,
      syncScheduler: null,

      // 设置配置
      setConfig: (config: WebDAVConfig) => {
        set({ config });
      },

      // 连接到 WebDAV 服务器
      connect: async (): Promise<boolean> => {
        const { config } = get();
        if (!config) {
          console.error("WebDAV连接失败: 配置为空");
          set({
            syncStatus: {
              status: "error",
              error: "请先配置 WebDAV 服务器",
            },
          });
          return false;
        }

        try {
          console.log("开始连接WebDAV服务器:", {
            serverUrl: config.serverUrl,
            username: config.username,
            basePath: config.basePath || "/resumes/",
          });

          set({
            syncStatus: { status: "syncing" },
          });

          // 使用支持代理自动切换的 webdavClient 替代直接的 WebDAV 客户端
          const connected = await webdavClient.initialize(config, true);

          if (!connected) {
            throw new Error("WebDAV 连接失败");
          }

          // 验证客户端是否正确初始化
          console.log("WebDAV客户端初始化状态:", {
            hasClient: !!webdavClient.client,
            hasConfig: !!webdavClient.config,
            syncStatus: webdavClient.getSyncStatus(),
          });

          set({
            isConnected: true,
            syncStatus: {
              status: "synced",
              lastSync: new Date(),
            },
          });

          // 启动状态监听器
          get().startStatusListener();

          console.log("✅ WebDAV连接成功");
          return true;
        } catch (error) {
          console.error("WebDAV连接失败:", error);
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
          syncStatus: { status: "idle" },
        });
      },

      // 测试连接
      testConnection: async (config: WebDAVConfig): Promise<boolean> => {
        try {
          // 首先尝试直接连接
          try {
            const client = createClient(config.serverUrl, {
              username: config.username,
              password: config.password,
            });

            await client.getDirectoryContents("/");
            return true;
          } catch (directError) {
            console.log("直接连接测试失败，尝试代理模式...", directError);

            // 如果直接连接失败，尝试代理模式
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
          }
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

      // 变更处理回调（简化版本）
      handleChangesDetected(changes: any) {
        console.log("检测到文件变更:", changes);
        // 简化的变更处理 - 可根据需要扩展
        if (typeof changes === "object" && changes !== null) {
          // 将变更转换为字符串格式以便记录
          const summary = get().generateChangesSummary(changes);
          console.log("变更摘要:", summary);
        }
      },

      // 启用/禁用智能同步（简化版本）
      enableSmartSync(enabled: boolean) {
        set({ isEnabled: enabled });
        // 如果需要可以在这里添加其他智能同步逻辑
      },

      // 简化的变更检测
      async detectChanges(resumeId?: string) {
        if (!webdavClient.config) {
          return {
            hasChanges: false,
            summary: "WebDAV客户端未配置",
          };
        }

        try {
          set({
            syncStatus: {
              ...get().syncStatus,
              status: "syncing",
            },
          });

          // 获取本地和远程简历进行比较
          const localResumes = get().getLocalResumeData();
          const remoteResumes = await webdavClient.getAllRemoteResumes();

          let hasChanges = false;
          let changedCount = 0;

          if (resumeId) {
            const localResume = localResumes.find((r) => r.id === resumeId);
            const remoteResume = remoteResumes[resumeId];

            if (localResume && remoteResume) {
              const localTime = new Date(localResume.updatedAt);
              const remoteTime = new Date(remoteResume.updatedAt);
              hasChanges =
                Math.abs(localTime.getTime() - remoteTime.getTime()) > 1000; // 1秒误差
              if (hasChanges) changedCount = 1;
            } else if (localResume || remoteResume) {
              hasChanges = true;
              changedCount = 1;
            }
          } else {
            // 检测所有简历
            const allIds = new Set([
              ...localResumes.map((r) => r.id),
              ...Object.keys(remoteResumes),
            ]);

            for (const id of allIds) {
              const localResume = localResumes.find((r) => r.id === id);
              const remoteResume = remoteResumes[id];

              if (localResume && remoteResume) {
                const localTime = new Date(localResume.updatedAt);
                const remoteTime = new Date(remoteResume.updatedAt);
                if (
                  Math.abs(localTime.getTime() - remoteTime.getTime()) > 1000
                ) {
                  hasChanges = true;
                  changedCount++;
                }
              } else if (localResume || remoteResume) {
                hasChanges = true;
                changedCount++;
              }
            }
          }

          const summary = hasChanges
            ? `检测到 ${changedCount} 个文件需要同步`
            : "所有文件已同步";

          set({
            syncStatus: {
              ...get().syncStatus,
              status: "synced",
            },
          });

          return {
            hasChanges,
            summary,
          };
        } catch (error) {
          set({
            syncStatus: {
              ...get().syncStatus,
              status: "error",
              error: error instanceof Error ? error.message : "检测变更失败",
            },
          });

          return {
            hasChanges: false,
            summary: "检测失败",
          };
        }
      },

      // 强制同步（简化版本）
      async forceSync() {
        if (!webdavClient.config) return false;

        try {
          set({
            syncStatus: {
              ...get().syncStatus,
              status: "syncing",
            },
          });

          // 使用 webdavClient 进行自动同步
          const result = await webdavClient.autoSyncAll();

          set({
            syncStatus: {
              status: result.success ? "synced" : "error",
              error: result.success
                ? undefined
                : `同步失败，${result.errorCount} 个错误`,
              lastSync: new Date(),
            },
          });

          return result.success;
        } catch (error) {
          set({
            syncStatus: {
              status: "error",
              error: error instanceof Error ? error.message : "强制同步失败",
            },
          });
          return false;
        }
      },

      // 页面加载时自动同步
      async autoSyncOnLoad() {
        const { isEnabled, config } = get();
        if (!isEnabled || !config) return false;

        try {
          // 连接到WebDAV
          const connected = await get().connect();
          if (!connected) return false;

          // 使用webdavClient进行自动同步
          await webdavClient.initialize(config, true); // 强制使用代理模式
          const result = await webdavClient.autoSyncAll();

          if (result.success) {
            set({
              syncStatus: {
                status: "synced",
                lastSync: new Date(),
              },
            });

            // 如果有同步内容，提示用户
            if (result.syncedCount > 0) {
              console.log(`已同步 ${result.syncedCount} 个简历`);
            }
          }

          return result.success;
        } catch (error) {
          console.error("自动同步失败:", error);
          return false;
        }
      },

      // 生成变更摘要
      generateChangesSummary(changes: Record<string, any>): string {
        const totalFiles = Object.keys(changes).length;
        const needsSyncFiles = Object.values(changes).filter(
          (change: any) =>
            change && typeof change === "object" && change.needsSync
        );

        if (needsSyncFiles.length === 0) {
          return "所有文件已同步";
        }

        return `共 ${totalFiles} 个文件，${needsSyncFiles.length} 个需要同步`;
      },
    }),
    {
      name: "webdav-store",
      partialize: (state) => ({
        config: state.config,
        isEnabled: state.isEnabled,
        // 不持久化运行时状态
      }),
    }
  )
);
