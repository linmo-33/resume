import { WebDAVClient } from "webdav";
import { ResumeData } from "@/types/resume";

export interface FileMetadata {
  etag?: string;
  lastModified?: Date;
  size?: number;
  contentHash?: string;
}

export interface SyncMetadata {
  [fileName: string]: FileMetadata;
}

export class WebDAVSyncDetector {
  private client: WebDAVClient | null = null;
  private basePath: string = "";
  private localMetadata: SyncMetadata = {};

  constructor(client: WebDAVClient | null, basePath: string) {
    this.client = client;
    this.basePath = basePath;
    this.loadLocalMetadata();
  }

  /**
   * 加载本地元数据缓存
   */
  private loadLocalMetadata(): void {
    try {
      const stored = localStorage.getItem("webdav-sync-metadata");
      if (stored) {
        this.localMetadata = JSON.parse(stored);
      }
    } catch (error) {
      console.warn("加载本地同步元数据失败:", error);
      this.localMetadata = {};
    }
  }

  /**
   * 保存本地元数据缓存
   */
  private saveLocalMetadata(): void {
    try {
      localStorage.setItem(
        "webdav-sync-metadata",
        JSON.stringify(this.localMetadata)
      );
    } catch (error) {
      console.warn("保存本地同步元数据失败:", error);
    }
  }

  /**
   * 计算文件内容哈希值
   */
  private calculateContentHash(content: string): string {
    // 使用简单的字符串哈希算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取远程文件元数据
   */
  async getRemoteFileMetadata(fileName: string): Promise<FileMetadata | null> {
    if (!this.client) return null;

    try {
      const filePath = `${this.basePath}${fileName}`;
      const stat = await this.client.stat(filePath);

      // 修复类型访问错误
      if (typeof stat === "object" && stat !== null) {
        // 检查是否是 ResponseDataDetailed 类型
        const fileInfo = "data" in stat ? stat.data : stat;

        return {
          etag: fileInfo.etag || undefined,
          lastModified: fileInfo.lastmod
            ? new Date(fileInfo.lastmod)
            : undefined,
          size: fileInfo.size || undefined,
        };
      }
    } catch (error) {
      // 文件不存在或其他错误
      return null;
    }

    return null;
  }

  /**
   * 获取本地文件元数据
   */
  getLocalFileMetadata(fileName: string, content: string): FileMetadata {
    const contentHash = this.calculateContentHash(content);

    return {
      contentHash,
      lastModified: new Date(),
      size: new Blob([content]).size,
    };
  }

  /**
   * 简化的文件变更检测 - 只检测是否需要同步
   */
  async detectFileChanges(
    fileName: string,
    localContent: string
  ): Promise<{
    needsSync: boolean;
    isRemoteNewer: boolean;
    remoteMetadata: FileMetadata | null;
    localMetadata: FileMetadata;
  }> {
    const localMetadata = this.getLocalFileMetadata(fileName, localContent);
    const remoteMetadata = await this.getRemoteFileMetadata(fileName);
    const cachedMetadata = this.localMetadata[fileName];

    // 检测本地变更
    const hasLocalChanges =
      !cachedMetadata ||
      cachedMetadata.contentHash !== localMetadata.contentHash;

    // 检测远程变更
    let isRemoteNewer = false;
    if (remoteMetadata && cachedMetadata) {
      // 使用 ETag 或修改时间检测变更
      if (remoteMetadata.etag && cachedMetadata.etag) {
        isRemoteNewer = remoteMetadata.etag !== cachedMetadata.etag;
      } else if (remoteMetadata.lastModified && cachedMetadata.lastModified) {
        isRemoteNewer =
          remoteMetadata.lastModified > cachedMetadata.lastModified;
      }
    } else if (remoteMetadata && !cachedMetadata) {
      // 远程有文件但本地没有缓存，说明是新的远程文件
      isRemoteNewer = true;
    }

    return {
      needsSync: hasLocalChanges || isRemoteNewer,
      isRemoteNewer,
      remoteMetadata,
      localMetadata,
    };
  }

  /**
   * 更新文件元数据缓存
   */
  updateFileMetadata(
    fileName: string,
    localMetadata: FileMetadata,
    remoteMetadata?: FileMetadata
  ): void {
    // 合并本地和远程元数据
    this.localMetadata[fileName] = {
      ...localMetadata,
      ...remoteMetadata,
    };

    this.saveLocalMetadata();
  }

  /**
   * 批量检测多个文件的变更 - 简化版本
   */
  async detectBatchChanges(files: Record<string, string>): Promise<
    Record<
      string,
      {
        needsSync: boolean;
        isRemoteNewer: boolean;
      }
    >
  > {
    const results: Record<string, any> = {};

    for (const [fileName, content] of Object.entries(files)) {
      try {
        const changes = await this.detectFileChanges(fileName, content);
        results[fileName] = {
          needsSync: changes.needsSync,
          isRemoteNewer: changes.isRemoteNewer,
        };

        // 添加小延迟避免频繁请求
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(`检测文件变更失败: ${fileName}`, error);
        results[fileName] = {
          needsSync: true, // 保守策略，假设有变更
          isRemoteNewer: false,
        };
      }
    }

    return results;
  }

  /**
   * 获取远程文件列表
   */
  async getRemoteFileList(): Promise<string[]> {
    if (!this.client) return [];

    try {
      const items = await this.client.getDirectoryContents(this.basePath);

      if (Array.isArray(items)) {
        return items
          .filter(
            (item) =>
              item.type === "file" &&
              typeof item.filename === "string" &&
              item.filename.includes("resume-") &&
              item.filename.endsWith(".json")
          )
          .map((item) => item.basename || item.filename.split("/").pop() || "");
      }
    } catch (error) {
      console.error("获取远程文件列表失败:", error);
    }

    return [];
  }

  /**
   * 检测新增或删除的文件
   */
  async detectFileListChanges(localFiles: string[]): Promise<{
    newRemoteFiles: string[];
    deletedRemoteFiles: string[];
    newLocalFiles: string[];
  }> {
    const remoteFiles = await this.getRemoteFileList();

    // 新增的远程文件（远程有但本地没有）
    const newRemoteFiles = remoteFiles.filter(
      (remote) => !localFiles.includes(remote)
    );

    // 删除的远程文件（本地有但远程没有）
    const deletedRemoteFiles = localFiles.filter(
      (local) => !remoteFiles.includes(local)
    );

    // 新增的本地文件（本地有但远程没有）
    const newLocalFiles = localFiles.filter(
      (local) => !remoteFiles.includes(local)
    );

    return {
      newRemoteFiles,
      deletedRemoteFiles,
      newLocalFiles,
    };
  }

  /**
   * 清理过期的元数据
   */
  cleanupMetadata(activeFiles: string[]): void {
    const currentMetadata = { ...this.localMetadata };

    // 删除不再存在的文件的元数据
    Object.keys(currentMetadata).forEach((fileName) => {
      if (!activeFiles.includes(fileName)) {
        delete currentMetadata[fileName];
      }
    });

    this.localMetadata = currentMetadata;
    this.saveLocalMetadata();
  }

  /**
   * 强制刷新所有元数据
   */
  async forceRefresh(): Promise<void> {
    this.localMetadata = {};
    this.saveLocalMetadata();
  }

  /**
   * 获取同步统计信息
   */
  getSyncStats(): {
    totalFiles: number;
    lastSyncTime?: Date;
    cacheSize: number;
  } {
    const totalFiles = Object.keys(this.localMetadata).length;
    const lastSyncTimes = Object.values(this.localMetadata)
      .map((meta) => meta.lastModified)
      .filter(Boolean) as Date[];

    const lastSyncTime =
      lastSyncTimes.length > 0
        ? new Date(Math.max(...lastSyncTimes.map((d) => d.getTime())))
        : undefined;

    const cacheSize = JSON.stringify(this.localMetadata).length;

    return {
      totalFiles,
      lastSyncTime,
      cacheSize,
    };
  }
}

// 简化的同步调度器
export class SyncScheduler {
  private detector: WebDAVSyncDetector;
  private interval: number;
  private isActive: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private onChangesDetected?: (changes: any) => void;

  constructor(
    detector: WebDAVSyncDetector,
    interval: number = 30000, // 30秒
    onChangesDetected?: (changes: any) => void
  ) {
    this.detector = detector;
    this.interval = interval;
    this.onChangesDetected = onChangesDetected;
  }

  /**
   * 启动定时检测
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.scheduleNextCheck();
  }

  /**
   * 停止定时检测
   */
  stop(): void {
    this.isActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 调度下一次检测
   */
  private scheduleNextCheck(): void {
    if (!this.isActive) return;

    this.timer = setTimeout(async () => {
      try {
        await this.performCheck();
      } catch (error) {
        console.warn("定时同步检测失败:", error);
      }

      // 调度下一次检测
      this.scheduleNextCheck();
    }, this.interval);
  }

  /**
   * 执行变更检测 - 简化版本
   */
  private async performCheck(): Promise<void> {
    // 这里需要从外部获取当前的简历数据
    const localFiles = this.getLocalFiles();

    if (Object.keys(localFiles).length === 0) return;

    const changes = await this.detector.detectBatchChanges(localFiles);

    // 检查是否有需要同步的变更
    const hasChanges = Object.values(changes).some(
      (change) => change.needsSync
    );

    if (hasChanges && this.onChangesDetected) {
      this.onChangesDetected(changes);
    }
  }

  /**
   * 获取本地文件（临时实现）
   */
  private getLocalFiles(): Record<string, string> {
    // 由于已删除本地文件保存功能，返回空对象
    return {};
  }

  /**
   * 更新检测间隔
   */
  updateInterval(newInterval: number): void {
    this.interval = newInterval;

    if (this.isActive) {
      this.stop();
      this.start();
    }
  }

  /**
   * 手动触发检测
   */
  async triggerCheck(): Promise<void> {
    await this.performCheck();
  }
}
