"use client";

import { ResumeData } from "@/types/resume";
import { webdavClient } from "./webdav";
import { useWebDAVStore } from "@/store/useWebDAVStore";
import { useResumeStore } from "@/store/useResumeStore";

export interface BatchSyncResult {
  success: number;
  failed: number;
  total: number;
  errors: Array<{ resumeId: string; title: string; error: string }>;
}

export interface BatchImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors: Array<{ fileName: string; error: string }>;
}

/**
 * 确保 webdavClient 已初始化
 */
async function ensureWebDAVInitialized() {
  const webdavStore = useWebDAVStore.getState();
  if (!webdavStore.isEnabled) {
    throw new Error("WebDAV 同步未启用，请先在设置中启用");
  }

  if (!webdavStore.config) {
    throw new Error("WebDAV 未配置，请先在设置中完成配置");
  }

  // 使用新的初始化状态检查方法
  if (!webdavClient.isInitialized()) {
    console.log("WebDAV客户端未初始化，正在初始化...");
    try {
      const ok = await webdavClient.initialize(webdavStore.config, true); // 强制使用代理模式
      if (!ok) throw new Error("WebDAV 客户端初始化失败，请检查配置和网络");
    } catch (error) {
      console.error("WebDAV初始化失败:", error);
      throw new Error(
        "WebDAV 客户端初始化失败: " +
          (error instanceof Error ? error.message : "未知错误")
      );
    }

    // 验证初始化结果
    if (!webdavClient.hasActiveClient()) {
      throw new Error("WebDAV 客户端初始化后仍无法获取活动客户端");
    }

    console.log("✅ WebDAV客户端初始化成功");
  }

  // 确保已连接
  if (!webdavStore.isConnected) {
    console.log("WebDAV未连接，尝试连接...");
    const connected = await webdavStore.connect();
    if (!connected) {
      throw new Error("WebDAV 连接失败，请检查网络和服务器状态");
    }
    console.log("✅ WebDAV连接成功");
  }
}

/**
 * 批量同步操作工具类
 */
export class WebDAVBatchOperations {
  /**
   * 批量同步所有本地简历到WebDAV
   */
  static async syncAllToWebDAV(): Promise<BatchSyncResult> {
    await ensureWebDAVInitialized();
    const webdavStore = useWebDAVStore.getState();
    const resumeStore = useResumeStore.getState();

    if (!webdavStore.isEnabled || !webdavStore.isConnected) {
      throw new Error("WebDAV 未启用或未连接");
    }

    const allResumes = Object.values(resumeStore.resumes);
    const result: BatchSyncResult = {
      success: 0,
      failed: 0,
      total: allResumes.length,
      errors: [],
    };

    // 更新同步状态 - 使用内部状态更新方法
    useWebDAVStore.setState({
      syncStatus: { status: "syncing" },
    });

    for (const resume of allResumes) {
      try {
        await webdavClient.smartSave(resume, true); // 强制同步
        result.success++;
        console.log(`✓ 简历 "${resume.title}" 同步成功`);
      } catch (error) {
        result.failed++;
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        result.errors.push({
          resumeId: resume.id,
          title: resume.title,
          error: errorMessage,
        });
        console.error(`✗ 简历 "${resume.title}" 同步失败:`, errorMessage);
      }
    }

    // 更新同步状态
    if (result.failed === 0) {
      useWebDAVStore.setState({
        syncStatus: { status: "synced", lastSync: new Date() },
      });
    } else {
      useWebDAVStore.setState({
        syncStatus: {
          status: "error",
          error: `批量同步完成，但有 ${result.failed} 个简历同步失败`,
        },
      });
    }

    return result;
  }

  /**
   * 从WebDAV批量导入简历
   */
  static async importAllFromWebDAV(): Promise<BatchImportResult> {
    await ensureWebDAVInitialized();
    const webdavStore = useWebDAVStore.getState();
    const resumeStore = useResumeStore.getState();

    if (!webdavStore.isEnabled || !webdavStore.isConnected) {
      throw new Error("WebDAV 未启用或未连接");
    }

    const result: BatchImportResult = {
      imported: 0,
      skipped: 0,
      total: 0,
      errors: [],
    };

    try {
      // 获取远程文件列表
      const basePath = webdavClient.config?.basePath || "/resumes/";

      // 使用统一的方法获取目录内容
      const files = await webdavClient.getDirectoryContents(basePath);

      const resumeFiles = files.filter(
        (file) =>
          typeof file.filename === "string" && file.filename.endsWith(".json")
      );

      result.total = resumeFiles.length;

      // 更新同步状态
      useWebDAVStore.setState({
        syncStatus: { status: "syncing" },
      });

      for (const file of resumeFiles) {
        try {
          if (typeof file.filename !== "string") continue;

          // 修复路径拼接问题
          let filePath: string;
          if (
            file.filename.startsWith("/") ||
            file.filename.includes(basePath)
          ) {
            filePath = file.filename;
          } else {
            filePath = `${basePath}${file.filename}`;
          }

          // 使用统一的方法获取文件内容
          const fileContent = await webdavClient.getFileContents(filePath);
          const resumeData: ResumeData = JSON.parse(fileContent);

          // 检查本地是否已存在该简历
          const localResume = resumeStore.resumes[resumeData.id];

          if (localResume) {
            // 比较时间戳，决定是否覆盖
            const localTime = new Date(localResume.updatedAt);
            const remoteTime = new Date(resumeData.updatedAt);

            if (remoteTime > localTime) {
              // 远程更新，导入覆盖
              resumeStore.updateResumeFromFile(resumeData);
              result.imported++;
              console.log(`✓ 更新本地简历 "${resumeData.title}"`);
            } else {
              // 本地更新，跳过
              result.skipped++;
              console.log(`- 跳过简历 "${resumeData.title}"（本地已是最新）`);
            }
          } else {
            // 新简历，直接导入
            resumeStore.updateResumeFromFile(resumeData);
            result.imported++;
            console.log(`✓ 导入新简历 "${resumeData.title}"`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "未知错误";
          result.errors.push({
            fileName:
              typeof file.filename === "string" ? file.filename : "未知文件",
            error: errorMessage,
          });
          console.error(`✗ 导入文件 "${file.filename}" 失败:`, errorMessage);
        }
      }

      // 更新同步状态
      if (result.errors.length === 0) {
        useWebDAVStore.setState({
          syncStatus: { status: "synced", lastSync: new Date() },
        });
      } else {
        useWebDAVStore.setState({
          syncStatus: {
            status: "error",
            error: `批量导入完成，但有 ${result.errors.length} 个文件导入失败`,
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      useWebDAVStore.setState({
        syncStatus: {
          status: "error",
          error: `获取远程文件列表失败: ${errorMessage}`,
        },
      });
      throw error;
    }

    return result;
  }

  /**
   * 双向同步（智能合并本地和远程简历）
   */
  static async bidirectionalSync(): Promise<{
    uploaded: BatchSyncResult;
    downloaded: BatchImportResult;
  }> {
    await ensureWebDAVInitialized();
    console.log("开始双向同步...");

    // 1. 首先从远程导入更新的简历
    console.log("1. 从远程导入更新的简历...");
    const downloaded = await this.importAllFromWebDAV();

    // 2. 然后将本地简历同步到远程
    console.log("2. 将本地简历同步到远程...");
    const uploaded = await this.syncAllToWebDAV();

    console.log("双向同步完成", { uploaded, downloaded });

    return { uploaded, downloaded };
  }

  /**
   * 清理远程孤儿文件（本地不存在的远程文件）
   */
  static async cleanupOrphanedFiles(): Promise<{
    deleted: number;
    errors: string[];
  }> {
    await ensureWebDAVInitialized();
    const webdavStore = useWebDAVStore.getState();
    const resumeStore = useResumeStore.getState();

    if (!webdavStore.isEnabled || !webdavStore.isConnected) {
      throw new Error("WebDAV 未启用或未连接");
    }

    const result = { deleted: 0, errors: [] as string[] };

    try {
      // 获取远程文件列表
      const basePath = webdavClient.config?.basePath || "/resumes/";
      const files = await webdavClient.getDirectoryContents(basePath);

      const resumeFiles = files.filter(
        (file) =>
          typeof file.filename === "string" && file.filename.endsWith(".json")
      );

      // 获取本地简历ID列表
      const localResumeIds = new Set(Object.keys(resumeStore.resumes));

      for (const file of resumeFiles) {
        try {
          if (typeof file.filename !== "string") continue;

          // 从文件名提取简历ID（假设格式为 resume-{id}.json）
          const match = file.filename.match(/resume-(.+)\.json$/);
          if (!match) continue;

          const resumeId = match[1];

          // 如果本地不存在该简历，删除远程文件
          if (!localResumeIds.has(resumeId)) {
            // 修复路径拼接问题
            let filePath: string;
            if (
              file.filename.startsWith("/") ||
              file.filename.includes(basePath)
            ) {
              filePath = file.filename;
            } else {
              filePath = `${basePath}${file.filename}`;
            }

            await webdavClient.deleteFile(filePath);
            result.deleted++;
            console.log(`✓ 删除孤儿文件: ${file.filename}`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "未知错误";
          result.errors.push(`删除文件 ${file.filename} 失败: ${errorMessage}`);
          console.error(`✗ 删除文件 ${file.filename} 失败:`, errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      result.errors.push(`获取远程文件列表失败: ${errorMessage}`);
      throw error;
    }

    return result;
  }

  /**
   * 检查同步状态（对比本地和远程的差异）
   */
  static async checkSyncStatus(): Promise<{
    localOnly: string[];
    remoteOnly: string[];
    conflicts: Array<{
      id: string;
      title: string;
      localTime: Date;
      remoteTime: Date;
    }>;
    synced: string[];
  }> {
    await ensureWebDAVInitialized();
    const webdavStore = useWebDAVStore.getState();
    const resumeStore = useResumeStore.getState();

    if (
      !webdavStore.isEnabled ||
      !webdavStore.isConnected ||
      !webdavClient.client
    ) {
      throw new Error("WebDAV 未启用或未连接");
    }

    const result = {
      localOnly: [] as string[],
      remoteOnly: [] as string[],
      conflicts: [] as Array<{
        id: string;
        title: string;
        localTime: Date;
        remoteTime: Date;
      }>,
      synced: [] as string[],
    };

    try {
      // 获取远程文件信息
      const remoteResumes = await webdavStore.loadRemoteResumes();
      const localResumes = resumeStore.resumes;

      const localIds = new Set(Object.keys(localResumes));
      const remoteIds = new Set(Object.keys(remoteResumes));

      // 检查仅在本地存在的简历 - 使用Array.from修复Set迭代兼容性问题
      for (const localId of Array.from(localIds)) {
        if (!remoteIds.has(localId)) {
          result.localOnly.push(localResumes[localId].title);
        }
      }

      // 检查仅在远程存在的简历 - 使用Array.from修复Set迭代兼容性问题
      for (const remoteId of Array.from(remoteIds)) {
        if (!localIds.has(remoteId)) {
          result.remoteOnly.push(remoteResumes[remoteId].title);
        }
      }

      // 检查冲突和已同步的简历 - 使用Array.from修复Set迭代兼容性问题
      for (const id of Array.from(localIds)) {
        if (remoteIds.has(id)) {
          const localResume = localResumes[id];
          const remoteResume = remoteResumes[id];
          const localTime = new Date(localResume.updatedAt);
          const remoteTime = new Date(remoteResume.updatedAt);

          if (Math.abs(localTime.getTime() - remoteTime.getTime()) > 1000) {
            // 时间差超过1秒，视为冲突
            result.conflicts.push({
              id,
              title: localResume.title,
              localTime,
              remoteTime,
            });
          } else {
            // 时间一致，视为已同步
            result.synced.push(localResume.title);
          }
        }
      }
    } catch (error) {
      console.error("检查同步状态失败:", error);
      throw error;
    }

    return result;
  }
}

export default WebDAVBatchOperations;
