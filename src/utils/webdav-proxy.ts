/**
 * WebDAV 代理客户端
 * 将 WebDAV 请求通过 Next.js API 路由进行代理，解决 CORS 问题
 */

import { WebDAVConfig } from "@/utils/webdav";

export interface WebDAVProxyResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  method?: string;
  path?: string;
}

export class WebDAVProxyClient {
  private config: WebDAVConfig;

  constructor(config: WebDAVConfig) {
    this.config = config;
  }

  /**
   * 通用代理请求方法
   */
  private async proxyRequest<T = any>(
    method: string,
    path: string,
    body?: string,
    headers?: Record<string, string>
  ): Promise<WebDAVProxyResponse<T>> {
    try {
      const response = await fetch("/api/webdav/proxy-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: this.config,
          method,
          path,
          body,
          headers,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 特殊处理404错误
        if (response.status === 404) {
          if (method === "PROPFIND") {
            // 对于PROPFIND操作，404通常意味着目录或文件不存在
            console.log(`WebDAV资源不存在 [${method}] ${path}`);
            throw new Error(`资源不存在: ${path}`);
          }
        }
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      // 优化错误日志，避免对预期的404错误显示过多日志
      if (error instanceof Error && error.message.includes("资源不存在")) {
        console.log(`WebDAV代理请求 [${method}] ${path}: ${error.message}`);
      } else {
        console.error(`WebDAV代理请求失败 [${method}] ${path}:`, error);
      }
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        serverUrl: this.config.serverUrl,
        username: this.config.username,
        password: this.config.password,
      });

      const response = await fetch(`/api/webdav/test-connection?${params}`, {
        method: "GET",
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("WebDAV连接测试失败:", error);
      return false;
    }
  }

  /**
   * 获取目录内容
   */
  async getDirectoryContents(path: string = "/"): Promise<any[]> {
    const response = await this.proxyRequest("GET", path);
    return response.data || [];
  }

  /**
   * 获取文件内容
   */
  async getFileContents(path: string): Promise<string> {
    const response = await this.proxyRequest("GET", path);
    return response.data || "";
  }

  /**
   * 创建或更新文件
   */
  async putFileContents(path: string, data: string): Promise<void> {
    await this.proxyRequest("PUT", path, data);
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    await this.proxyRequest("DELETE", path);
  }

  /**
   * 创建目录
   */
  async createDirectory(path: string): Promise<void> {
    await this.proxyRequest("MKCOL", path);
  }

  /**
   * 获取文件/目录状态信息
   */
  async stat(path: string): Promise<any> {
    const response = await this.proxyRequest("PROPFIND", path);
    return response.data;
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
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

      // 其他错误需要记录并继续抛出
      console.error(`检查资源存在性失败 [${path}]:`, error);
      throw error;
    }
  }

  /**
   * 移动文件（通过复制+删除实现）
   */
  async moveFile(fromPath: string, toPath: string): Promise<void> {
    try {
      // 获取源文件内容
      const content = await this.getFileContents(fromPath);

      // 创建目标文件
      await this.putFileContents(toPath, content);

      // 删除源文件
      await this.deleteFile(fromPath);
    } catch (error) {
      console.error(`移动文件失败 ${fromPath} -> ${toPath}:`, error);
      throw error;
    }
  }

  /**
   * 复制文件
   */
  async copyFile(fromPath: string, toPath: string): Promise<void> {
    try {
      const content = await this.getFileContents(fromPath);
      await this.putFileContents(toPath, content);
    } catch (error) {
      console.error(`复制文件失败 ${fromPath} -> ${toPath}:`, error);
      throw error;
    }
  }

  /**
   * 确保目录存在（递归创建）
   */
  async ensureDirectoryExists(path: string): Promise<void> {
    const pathParts = path.split("/").filter(Boolean);
    let currentPath = "";

    for (const part of pathParts) {
      currentPath += "/" + part;

      try {
        await this.stat(currentPath);
      } catch (error) {
        // 目录不存在，创建它
        await this.createDirectory(currentPath);
      }
    }
  }

  /**
   * 获取文件列表（仅文件，不包括目录）
   */
  async getFileList(path: string = "/"): Promise<string[]> {
    try {
      const contents = await this.getDirectoryContents(path);
      return contents
        .filter((item: any) => item.type === "file")
        .map((item: any) => item.filename || item.basename);
    } catch (error) {
      console.error(`获取文件列表失败 ${path}:`, error);
      return [];
    }
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(files: { path: string; content: string }[]): Promise<{
    success: number;
    failed: number;
    errors: Array<{ path: string; error: string }>;
  }> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ path: string; error: string }> = [];

    for (const file of files) {
      try {
        await this.putFileContents(file.path, file.content);
        success++;
      } catch (error) {
        failed++;
        errors.push({
          path: file.path,
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
    }

    return { success, failed, errors };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: WebDAVConfig): void {
    this.config = newConfig;
  }
}
