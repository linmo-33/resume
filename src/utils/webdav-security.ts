"use client";

import { ResumeData } from "@/types/resume";

// 安全配置接口
export interface SecurityConfig {
  enableEncryption: boolean;
  encryptionKey?: string;
  enableAccessControl: boolean;
  maxFileSize: number; // 最大文件大小（字节）
  allowedExtensions: string[];
  enableAuditLog: boolean;
}

// 默认安全配置
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableEncryption: false, // 默认不加密，用户可选
  enableAccessControl: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: [".json", ".md", ".txt"],
  enableAuditLog: true,
};

// 操作审计日志
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  resumeId?: string;
  success: boolean;
  userAgent: string;
  ip?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// 访问权限类型
export enum PermissionType {
  Read = "read",
  Write = "write",
  Delete = "delete",
  Admin = "admin",
}

/**
 * WebDAV 安全管理器
 */
export class WebDAVSecurity {
  private config: SecurityConfig;
  private auditLogs: AuditLogEntry[] = [];
  private encryptionKey?: CryptoKey;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * 初始化加密密钥
   */
  async initializeEncryption(password?: string): Promise<void> {
    if (!this.config.enableEncryption) return;

    try {
      if (password) {
        // 使用用户提供的密码生成密钥
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest(
          "SHA-256",
          passwordBuffer
        );

        this.encryptionKey = await crypto.subtle.importKey(
          "raw",
          hashBuffer,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
        );
      } else {
        // 生成随机密钥
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      }

      console.log("WebDAV Security: 加密已初始化");
    } catch (error) {
      console.error("WebDAV Security: 加密初始化失败:", error);
      throw error;
    }
  }

  /**
   * 加密数据
   */
  async encryptData(data: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.config.enableEncryption || !this.encryptionKey) {
      throw new Error("加密未启用或未初始化");
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // 生成随机IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // 加密数据
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        this.encryptionKey,
        dataBuffer
      );

      // 转换为Base64字符串
      const encrypted = btoa(
        String.fromCharCode(...new Uint8Array(encryptedBuffer))
      );
      const ivString = btoa(String.fromCharCode(...Array.from(iv)));

      return { encrypted, iv: ivString };
    } catch (error) {
      console.error("WebDAV Security: 数据加密失败:", error);
      throw error;
    }
  }

  /**
   * 解密数据
   */
  async decryptData(encryptedData: string, ivString: string): Promise<string> {
    if (!this.config.enableEncryption || !this.encryptionKey) {
      throw new Error("加密未启用或未初始化");
    }

    try {
      // 从Base64解码
      const encryptedBuffer = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map((char) => char.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(ivString)
          .split("")
          .map((char) => char.charCodeAt(0))
      );

      // 解密数据
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        this.encryptionKey,
        encryptedBuffer
      );

      // 转换为字符串
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error("WebDAV Security: 数据解密失败:", error);
      throw error;
    }
  }

  /**
   * 验证文件安全性
   */
  validateFile(
    fileName: string,
    fileSize: number,
    content?: string
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查文件大小
    if (fileSize > this.config.maxFileSize) {
      errors.push(`文件大小超出限制 (${this.config.maxFileSize} 字节)`);
    }

    // 检查文件扩展名
    const extension = fileName.substring(fileName.lastIndexOf("."));
    if (!this.config.allowedExtensions.includes(extension)) {
      errors.push(`不允许的文件类型: ${extension}`);
    }

    // 检查文件名安全性
    if (this.containsUnsafeCharacters(fileName)) {
      errors.push("文件名包含不安全字符");
    }

    // 检查内容安全性（如果提供）
    if (content && this.containsMaliciousContent(content)) {
      errors.push("文件内容包含潜在的恶意代码");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查文件名是否包含不安全字符
   */
  private containsUnsafeCharacters(fileName: string): boolean {
    const unsafePatterns = [
      /\.\./, // 路径穿越
      /[<>:"|?*]/, // Windows不允许的字符
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, // Windows保留名称
    ];

    return unsafePatterns.some((pattern) => pattern.test(fileName));
  }

  /**
   * 检查内容是否包含恶意代码
   */
  private containsMaliciousContent(content: string): boolean {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script标签
      /javascript:/i, // JavaScript协议
      /data:text\/html/i, // HTML数据URI
      /vbscript:/i, // VBScript协议
    ];

    return maliciousPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * 清理简历数据（移除潜在的不安全内容）
   */
  sanitizeResumeData(resume: ResumeData): ResumeData {
    const sanitized = JSON.parse(JSON.stringify(resume)); // 深拷贝

    // 清理HTML标签和脚本
    const cleanText = (text: string): string => {
      if (typeof text !== "string") return text;

      return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // 移除script标签
        .replace(/javascript:/gi, "") // 移除javascript协议
        .replace(/vbscript:/gi, "") // 移除vbscript协议
        .replace(/on\w+\s*=/gi, "") // 移除事件处理器
        .trim();
    };

    // 递归清理对象中的所有字符串值
    const cleanObject = (obj: any): any => {
      if (typeof obj === "string") {
        return cleanText(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(cleanObject);
      } else if (obj && typeof obj === "object") {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          cleaned[key] = cleanObject(value);
        }
        return cleaned;
      }
      return obj;
    };

    return cleanObject(sanitized);
  }

  /**
   * 记录操作审计日志
   */
  logOperation(
    operation: string,
    success: boolean,
    options: {
      resumeId?: string;
      error?: string;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    if (!this.config.enableAuditLog) return;

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      operation,
      resumeId: options.resumeId,
      success,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
      error: options.error,
      metadata: options.metadata,
    };

    this.auditLogs.push(logEntry);

    // 保持日志数量在合理范围内
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-500); // 保留最新的500条
    }

    console.log("WebDAV Security: 记录审计日志:", logEntry);
  }

  /**
   * 获取审计日志
   */
  getAuditLogs(filter?: {
    operation?: string;
    resumeId?: string;
    success?: boolean;
    startTime?: Date;
    endTime?: Date;
  }): AuditLogEntry[] {
    let logs = [...this.auditLogs];

    if (filter) {
      logs = logs.filter((log) => {
        if (filter.operation && log.operation !== filter.operation)
          return false;
        if (filter.resumeId && log.resumeId !== filter.resumeId) return false;
        if (filter.success !== undefined && log.success !== filter.success)
          return false;
        if (filter.startTime && log.timestamp < filter.startTime) return false;
        if (filter.endTime && log.timestamp > filter.endTime) return false;
        return true;
      });
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 清理审计日志
   */
  clearAuditLogs(olderThan?: Date): void {
    if (olderThan) {
      this.auditLogs = this.auditLogs.filter(
        (log) => log.timestamp >= olderThan
      );
    } else {
      this.auditLogs = [];
    }

    console.log("WebDAV Security: 审计日志已清理");
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查操作权限
   */
  checkPermission(operation: PermissionType): boolean {
    if (!this.config.enableAccessControl) return true;

    // 这里可以根据具体需求实现权限检查逻辑
    // 目前简单返回true，实际应用中可以集成更复杂的权限系统
    return true;
  }

  /**
   * 生成安全令牌
   */
  async generateSecurityToken(payload: Record<string, any>): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.error("WebDAV Security: 令牌生成失败:", error);
      throw error;
    }
  }

  /**
   * 验证安全令牌
   */
  async validateSecurityToken(
    token: string,
    payload: Record<string, any>
  ): Promise<boolean> {
    try {
      const expectedToken = await this.generateSecurityToken(payload);
      return token === expectedToken;
    } catch (error) {
      console.error("WebDAV Security: 令牌验证失败:", error);
      return false;
    }
  }

  /**
   * 获取安全配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 更新安全配置
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("WebDAV Security: 安全配置已更新", this.config);
  }

  /**
   * 获取安全统计信息
   */
  getSecurityStats(): {
    auditLogCount: number;
    encryptionEnabled: boolean;
    accessControlEnabled: boolean;
    recentFailures: number;
  } {
    const recentTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
    const recentFailures = this.auditLogs.filter(
      (log) => !log.success && log.timestamp >= recentTime
    ).length;

    return {
      auditLogCount: this.auditLogs.length,
      encryptionEnabled: this.config.enableEncryption,
      accessControlEnabled: this.config.enableAccessControl,
      recentFailures,
    };
  }
}

// 导出全局安全管理器实例
export const webdavSecurity = new WebDAVSecurity();

export default WebDAVSecurity;
