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

  if (!webdavClient.isInitialized()) {
    console.log("WebDAV客户端未初始化，正在初始化...");
    try {
      const ok = await webdavClient.initialize(webdavStore.config);
      if (!ok) throw new Error("WebDAV 客户端初始化失败，请检查配置和网络");
    } catch (error) {
      console.error("WebDAV初始化失败:", error);
      throw new Error(
        "WebDAV 客户端初始化失败: " +
          (error instanceof Error ? error.message : "未知错误")
      );
    }
    console.log("✅ WebDAV客户端初始化成功");
  }

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

    useWebDAVStore.setState({
      syncStatus: { status: "syncing" },
    });

    for (const resume of allResumes) {
      try {
        await webdavClient.smartSave(resume, true);
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
      const basePath = webdavClient.config?.basePath || "/resumes/";
      const files = await webdavClient.getDirectoryContents(basePath);

      const resumeFiles = files.filter(
        (file: any) =>
          typeof file.filename === "string" && file.filename.endsWith(".json")
      );

      result.total = resumeFiles.length;

      useWebDAVStore.setState({
        syncStatus: { status: "syncing" },
      });

      for (const file of resumeFiles) {
        try {
          if (typeof file.filename !== "string") continue;

          let filePath: string;
          if (
            file.filename.startsWith("/") ||
            file.filename.includes(basePath)
          ) {
            filePath = file.filename;
          } else {
            filePath = `${basePath}${file.filename}`;
          }

          const fileContent = await webdavClient.getFileContents(filePath);
          const resumeData: ResumeData = JSON.parse(fileContent);

          const localResume = resumeStore.resumes[resumeData.id];

          if (localResume) {
            const localTime = new Date(localResume.updatedAt);
            const remoteTime = new Date(resumeData.updatedAt);

            if (remoteTime > localTime) {
              resumeStore.updateResumeFromFile(resumeData);
              result.imported++;
              console.log(`✓ 简历 "${resumeData.title}" 已更新`);
            } else {
              result.skipped++;
              console.log(`= 简历 "${resumeData.title}" 已是最新版本，跳过`);
            }
          } else {
            resumeStore.addResume(resumeData);
            result.imported++;
            console.log(`✓ 简历 "${resumeData.title}" 已导入`);
          }
        } catch (error) {
          result.errors.push({
            fileName: file.filename || "未知文件",
            error: error instanceof Error ? error.message : "导入失败",
          });
          console.error(`✗ 文件 "${file.filename}" 导入失败:`, error);
        }
      }

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

      return result;
    } catch (error) {
      result.errors.push({
        fileName: "目录列表",
        error: error instanceof Error ? error.message : "获取远程文件列表失败",
      });

      useWebDAVStore.setState({
        syncStatus: {
          status: "error",
          error:
            "批量导入失败: " +
            (error instanceof Error ? error.message : "未知错误"),
        },
      });

      return result;
    }
  }

  /**
   * 自动同步 - 结合上传和下载
   */
  static async autoSync(): Promise<{
    uploaded: BatchSyncResult;
    downloaded: BatchImportResult;
  }> {
    try {
      console.log("开始自动同步...");

      // 先上传本地更改
      const uploaded = await this.syncAllToWebDAV();
      console.log("上传阶段完成:", uploaded);

      // 再下载远程更改
      const downloaded = await this.importAllFromWebDAV();
      console.log("下载阶段完成:", downloaded);

      return { uploaded, downloaded };
    } catch (error) {
      console.error("自动同步失败:", error);
      throw error;
    }
  }
}
