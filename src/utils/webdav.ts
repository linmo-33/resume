import { createClient, WebDAVClient } from "webdav";
import { ResumeData } from "@/types/resume";
import { WebDAVProxyClient } from "./webdav-proxy";

export interface WebDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  basePath?: string;
}

export interface SyncStrategy {
  autoSync: boolean; // 是否自动同步
  syncInterval: number; // 同步间隔（秒）
}

export interface SyncStatus {
  status: "idle" | "syncing" | "synced" | "error";
  lastSync?: Date;
  error?: string;
}

export class WebDAVSyncClient {
  public client: WebDAVClient | null = null;
  public config: WebDAVConfig | null = null;
  private proxyClient: WebDAVProxyClient | null = null;
  private useProxy: boolean = false;
  private listeners: (() => void)[] = [];
  private networkStatusListener: (() => void) | null = null;
  public syncStatus: SyncStatus = { status: "idle" };

  constructor() {
    // 默认同步策略
    this.syncStatus = { status: "idle" };
  }

  /**
   * 初始化 WebDAV 客户端
   * 优化：直接使用代理模式，避免跨域错误日志
   */
  async initialize(
    config: WebDAVConfig,
    forceProxy: boolean = true
  ): Promise<boolean> {
    try {
      this.config = config;

      if (forceProxy) {
        // 直接使用代理模式，避免跨域尝试
        console.log("使用代理模式连接WebDAV...");
        this.proxyClient = new WebDAVProxyClient(config);
        const proxyTest = await this.proxyClient.testConnection();

        if (proxyTest) {
          this.useProxy = true;
          this.client = null;
          console.log("✅ 代理模式连接成功");
        } else {
          throw new Error("代理模式连接失败");
        }
      } else {
        // 原有的自动检测逻辑（保留兼容性）
        console.log("尝试直接WebDAV连接...");
        try {
          this.client = createClient(config.serverUrl, {
            username: config.username,
            password: config.password,
          });

          await this.client.getDirectoryContents("/");
          this.useProxy = false;
          console.log("直接WebDAV连接成功");
        } catch (directError) {
          console.log("直接连接失败，切换到代理模式...");

          this.proxyClient = new WebDAVProxyClient(config);
          const proxyTest = await this.proxyClient.testConnection();

          if (proxyTest) {
            this.useProxy = true;
            this.client = null;
            console.log("代理模式连接成功");
          } else {
            throw new Error("直接连接和代理模式都失败");
          }
        }
      }

      // 确保基础目录存在
      const basePath = config.basePath || "/resumes/";
      try {
        console.log(`确保基础目录存在: ${basePath}`);
        await this.ensureDirectoryExists(basePath);
      } catch (error) {
        console.warn(`创建基础目录失败: ${basePath}`, error);
        // 继续执行，不中断初始化过程
      }

      this.syncStatus = { status: "synced", lastSync: new Date() };
      return true;
    } catch (error) {
      console.error("WebDAV 初始化失败:", error);
      this.syncStatus = {
        status: "error",
        error: error instanceof Error ? error.message : "初始化失败",
      };
      return false;
    }
  }

  /**
   * 获取当前活动的客户端（直接或代理）
   */
  private getActiveClient(): WebDAVClient | WebDAVProxyClient {
    if (this.useProxy && this.proxyClient) {
      return this.proxyClient;
    }
    if (this.client) {
      return this.client;
    }
    throw new Error("没有可用的WebDAV客户端");
  }

  /**
   * 统一的文件存在性检查
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const client = this.getActiveClient();
      if (this.useProxy && this.proxyClient) {
        return await this.proxyClient.exists(path);
      } else {
        await (client as WebDAVClient).stat(path);
        return true;
      }
    } catch (error) {
      // 特殊处理404错误，这是预期的结果
      if (
        error instanceof Error &&
        (error.message.includes("资源不存在") ||
          error.message.includes("404") ||
          error.message.includes("Not Found"))
      ) {
        return false;
      }

      // 其他错误可能是网络问题或权限问题，记录并返回false
      console.warn(
        `检查文件存在性失败 [${path}]:`,
        error instanceof Error ? error.message : "未知错误"
      );
      return false;
    }
  }

  /**
   * 统一的目录内容获取
   */
  async getDirectoryContents(path: string): Promise<any[]> {
    const client = this.getActiveClient();
    if (this.useProxy && this.proxyClient) {
      return await this.proxyClient.getDirectoryContents(path);
    } else {
      const result = await (client as WebDAVClient).getDirectoryContents(path);
      // 处理 WebDAV 客户端可能返回的不同类型
      return Array.isArray(result) ? result : (result as any).data || [];
    }
  }

  /**
   * 统一的文件内容获取
   */
  async getFileContents(path: string): Promise<string> {
    const client = this.getActiveClient();
    if (this.useProxy && this.proxyClient) {
      return await this.proxyClient.getFileContents(path);
    } else {
      const content = await (client as WebDAVClient).getFileContents(path, {
        format: "text",
      });
      return content as string;
    }
  }

  /**
   * 统一的文件上传
   */
  async putFileContents(path: string, content: string): Promise<void> {
    try {
      const client = this.getActiveClient();
      if (this.useProxy && this.proxyClient) {
        await this.proxyClient.putFileContents(path, content);
      } else {
        await (client as WebDAVClient).putFileContents(path, content);
      }
    } catch (error) {
      // 如果是409错误，可能是父目录不存在
      if (
        error instanceof Error &&
        (error.message.includes("409") || error.message.includes("Conflict"))
      ) {
        console.error(`上传文件失败(409冲突): ${path} - 父目录可能不存在`);
        throw new Error(`上传文件失败: 父目录不存在 (${path})`);
      } else {
        console.error(`上传文件失败: ${path}`, error);
        throw error;
      }
    }
  }

  /**
   * 统一的文件删除
   */
  async deleteFile(path: string): Promise<void> {
    const client = this.getActiveClient();
    if (this.useProxy && this.proxyClient) {
      await this.proxyClient.deleteFile(path);
    } else {
      await (client as WebDAVClient).deleteFile(path);
    }
  }

  /**
   * 检查是否应该使用远程版本
   */
  private async shouldUseRemoteVersion(
    resumeData: ResumeData
  ): Promise<boolean> {
    if (!this.config) return false;

    try {
      const remoteFileName = this.getRemoteFilePath(resumeData.id);
      const exists = await this.fileExists(remoteFileName);

      if (!exists) return false; // 新文件，无需检查

      // 获取远程文件内容
      const remoteContent = await this.getFileContents(remoteFileName);
      const remoteResume = JSON.parse(remoteContent) as ResumeData;

      // 比较修改时间
      const localTime = new Date(resumeData.updatedAt);
      const remoteTime = new Date(remoteResume.updatedAt);

      // 如果远程文件更新，使用远程版本
      return remoteTime > localTime;
    } catch (error) {
      console.error("检查远程版本失败:", error);
      return false;
    }
  }

  /**
   * 简化的智能保存 - 仅WebDAV云端同步
   */
  async smartSave(resumeData: ResumeData, forceSync = false): Promise<void> {
    if (!this.isInitialized()) {
      throw new Error("WebDAV 客户端未初始化");
    }

    if (!this.hasActiveClient()) {
      throw new Error("WebDAV 活动客户端不可用");
    }

    try {
      this.syncStatus.status = "syncing";

      // 1. 简单的时间戳检查
      if (!forceSync) {
        const shouldUseRemote = await this.shouldUseRemoteVersion(resumeData);
        if (shouldUseRemote) {
          // 远程版本更新，下载并使用远程版本
          const remoteResume = await this.downloadResume(resumeData.id);
          if (remoteResume) {
            this.syncStatus = {
              status: "synced",
              lastSync: new Date(),
            };
            console.log(`简历 "${resumeData.title}" 已同步远程版本`);
            return;
          }
        }
      }

      // 2. 上传到 WebDAV
      await this.uploadResume(resumeData);

      // 3. 更新同步状态
      this.syncStatus = {
        status: "synced",
        lastSync: new Date(),
      };

      console.log(`简历 "${resumeData.title}" 同步成功`);
    } catch (error) {
      console.error("智能保存失败:", error);
      this.syncStatus = {
        status: "error",
        error: error instanceof Error ? error.message : "同步失败",
      };
      throw error;
    }
  }

  /**
   * 上传简历到 WebDAV
   */
  async uploadResume(resumeData: ResumeData): Promise<void> {
    if (!this.config) {
      throw new Error("WebDAV 客户端未初始化");
    }

    const fileName = this.getRemoteFilePath(resumeData.id);
    await this.putFileContents(fileName, JSON.stringify(resumeData, null, 2));
  }

  /**
   * 从 WebDAV 下载简历
   */
  async downloadResume(resumeId: string): Promise<ResumeData | null> {
    if (!this.config) return null;

    try {
      const fileName = this.getRemoteFilePath(resumeId);
      const content = await this.getFileContents(fileName);

      return JSON.parse(content) as ResumeData;
    } catch (error) {
      console.error("下载简历失败:", error);
      return null;
    }
  }

  /**
   * 获取所有远程简历
   */
  async getAllRemoteResumes(): Promise<Record<string, ResumeData>> {
    if (!this.config) return {};

    try {
      const basePath = this.config.basePath || "/resumes/";
      const contents = await this.getDirectoryContents(basePath);
      const resumes: Record<string, ResumeData> = {};

      if (Array.isArray(contents)) {
        for (const item of contents) {
          if (
            item.type === "file" &&
            typeof item.filename === "string" &&
            item.filename.includes("resume-") &&
            item.filename.endsWith(".json")
          ) {
            try {
              // 修复路径拼接问题：检查filename是否已包含完整路径
              let filePath: string;
              if (
                item.filename.startsWith("/") ||
                item.filename.includes(basePath.replace(/\/$/, ""))
              ) {
                // filename 已经是完整路径
                filePath = item.filename;
              } else {
                // filename 只是文件名，需要拼接basePath
                filePath = `${basePath}${item.filename}`;
              }

              const fileContent = await this.getFileContents(filePath);
              const resumeData = JSON.parse(fileContent) as ResumeData;
              resumes[resumeData.id] = resumeData;
            } catch (error) {
              console.warn(`读取文件失败: ${item.filename}`, error);
            }
          }
        }
      }

      return resumes;
    } catch (error) {
      console.error("获取远程简历失败:", error);
      return {};
    }
  }

  /**
   * 自动同步所有简历
   */
  async autoSyncAll(): Promise<{
    success: boolean;
    syncedCount: number;
    errorCount: number;
  }> {
    if (!this.config) {
      return { success: false, syncedCount: 0, errorCount: 1 };
    }

    try {
      this.syncStatus.status = "syncing";

      // 获取远程简历
      const remoteResumes = await this.getAllRemoteResumes();

      let syncedCount = 0;
      let errorCount = 0;

      // 仅处理远程简历
      const remoteIds = Object.keys(remoteResumes);

      for (const resumeId of remoteIds) {
        try {
          const resumeData = remoteResumes[resumeId];
          if (resumeData) {
            // 这里可以触发UI层的简历数据更新回调
            console.log(`远程简历同步: ${resumeData.title || resumeId}`);
            syncedCount++;
          }
        } catch (error) {
          console.error(`同步简历 ${resumeId} 失败:`, error);
          errorCount++;
        }
      }

      // 更新同步状态
      this.syncStatus = {
        status: "synced",
        lastSync: new Date(),
      };

      console.log(`自动同步完成: ${syncedCount} 成功, ${errorCount} 失败`);

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
      };
    } catch (error) {
      console.error("自动同步失败:", error);
      this.syncStatus = {
        status: "error",
        error: error instanceof Error ? error.message : "自动同步失败",
      };
      return { success: false, syncedCount: 0, errorCount: 1 };
    }
  }

  /**
   * 获取远程文件路径
   */
  private getRemoteFilePath(resumeId: string): string {
    const basePath = this.config?.basePath || "/resumes/";
    return `${basePath}resume-${resumeId}.json`;
  }

  /**
   * 获取简历文件名
   */
  private getResumeFileName(resumeId: string): string {
    return `resume-${resumeId}.json`;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.client = null;
    this.config = null;
    this.syncStatus = { status: "idle" };
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  /**
   * 检查客户端是否已正确初始化（支持代理模式）
   */
  isInitialized(): boolean {
    return (
      this.config !== null &&
      ((this.useProxy && this.proxyClient !== null) ||
        (!this.useProxy && this.client !== null))
    );
  }

  /**
   * 检查是否有可用的活动客户端
   */
  hasActiveClient(): boolean {
    try {
      this.getActiveClient();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除简历
   */
  async deleteResume(resumeId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error("WebDAV 客户端未初始化");
    }

    if (!this.hasActiveClient()) {
      throw new Error("WebDAV 活动客户端不可用");
    }

    try {
      console.log(`开始删除简历: ${resumeId}`);
      this.syncStatus.status = "syncing";

      // 删除简历文件
      const filePath = this.getRemoteFilePath(resumeId);
      const fileExists = await this.fileExists(filePath);

      if (fileExists) {
        await this.deleteFile(filePath);
        console.log(`已删除简历文件: ${filePath}`);
      } else {
        console.log(`简历文件不存在: ${filePath}`);
      }

      // 更新同步状态
      this.syncStatus = {
        status: "synced",
        lastSync: new Date(),
      };

      console.log(`简历 ${resumeId} 删除成功`);
      return true;
    } catch (error) {
      console.error(
        "删除简历失败:",
        error instanceof Error ? error.message : "未知错误"
      );
      this.syncStatus = {
        status: "error",
        error: error instanceof Error ? error.message : "删除失败",
      };
      throw error;
    }
  }

  /**
   * 确保目录存在（递归创建）
   */
  async ensureDirectoryExists(path: string): Promise<void> {
    if (!path || path === "/" || path === "") return;

    // 规范化路径
    const normalizedPath = path.endsWith("/") ? path : path + "/";

    try {
      // 先检查目录是否已存在
      const exists = await this.fileExists(normalizedPath);
      if (exists) {
        return; // 目录已存在，无需创建
      }

      // 分解路径
      const pathParts = normalizedPath.split("/").filter(Boolean);
      let currentPath = "/";

      // 递归创建每一级目录
      for (const part of pathParts) {
        currentPath += part + "/";

        try {
          const dirExists = await this.fileExists(currentPath);
          if (!dirExists) {
            console.log(`创建目录: ${currentPath}`);
            await this.createDirectory(currentPath);
          }
        } catch (error) {
          // 如果是409错误(冲突)，可能是目录已存在，继续处理
          if (
            error instanceof Error &&
            !(
              error.message.includes("409") ||
              error.message.includes("Conflict")
            )
          ) {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`递归创建目录失败 [${path}]:`, error);
      throw new Error(
        `无法创建目录 ${path}: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  }

  /**
   * 统一的目录创建方法
   */
  async createDirectory(path: string): Promise<void> {
    const client = this.getActiveClient();
    if (this.useProxy && this.proxyClient) {
      await this.proxyClient.createDirectory(path);
    } else {
      await (client as WebDAVClient).createDirectory(path);
    }
  }
}

// 导出默认实例
export const webdavClient = new WebDAVSyncClient();
