# WebDAV 集成使用指南

Magic Resume 现在支持 WebDAV 云端同步功能，让您可以在多个设备间同步简历数据，同时保持数据主权和隐私控制。

## 目录

1. [功能概述](#功能概述)
2. [支持的服务商](#支持的服务商)
3. [快速开始](#快速开始)
4. [配置详解](#配置详解)
5. [功能特性](#功能特性)
6. [API 文档](#api-文档)
7. [故障排除](#故障排除)
8. [安全说明](#安全说明)

## 功能概述

WebDAV 集成提供以下核心功能：

- **多设备同步**：在不同设备间自动同步简历数据
- **智能冲突处理**：基于时间戳的简单覆盖策略
- **版本历史管理**：自动备份和版本恢复功能
- **批量操作**：支持批量上传、下载、同步和清理
- **缓存优化**：智能缓存减少网络请求
- **错误恢复**：自动重试和断线重连
- **安全保护**：数据验证和审计日志

## 支持的服务商

### 坚果云 (推荐)

- **服务器地址**: `https://dav.jianguoyun.com/dav/`
- **用户名**: 坚果云账号邮箱
- **密码**: 应用密码（非登录密码）
- **获取应用密码**: 坚果云网页版 → 账户信息 → 安全选项 → 第三方应用管理

### Nextcloud

- **服务器地址**: `https://your-domain.com/remote.php/dav/files/username/`
- **用户名**: Nextcloud 用户名
- **密码**: Nextcloud 密码或应用专用密码

### ownCloud

- **服务器地址**: `https://your-domain.com/remote.php/webdav/`
- **用户名**: ownCloud 用户名
- **密码**: ownCloud 密码

### 自定义 WebDAV 服务

- **服务器地址**: 您的 WebDAV 服务器 URL
- **用户名**: 服务器用户名
- **密码**: 服务器密码

## 快速开始

### 1. 启用 WebDAV 同步

1. 打开 Magic Resume
2. 进入 **设置** → **云端同步** 选项卡
3. 选择您的服务商预设或选择"自定义"
4. 填写连接信息
5. 点击"测试连接"验证配置
6. 点击"保存配置"启用同步

### 2. 初始同步

启用 WebDAV 后，系统会自动：

- 检查远程是否有数据
- 如果远程有更新的数据，会自动下载
- 如果本地有新数据，会自动上传

### 3. 日常使用

- **自动同步**：每次编辑简历后会自动保存到云端
- **手动同步**：在设置页面可以手动触发同步
- **批量操作**：使用批量操作面板进行大量数据管理

## 配置详解

### 基本配置

```typescript
interface WebDAVConfig {
  url: string; // WebDAV 服务器地址
  username: string; // 用户名
  password: string; // 密码
  enabled: boolean; // 是否启用
  basePath?: string; // 基础路径（可选）
}
```

### 高级设置

```typescript
interface SyncStrategy {
  autoSave: boolean; // 自动保存（默认：true）
  autoSyncInterval: number; // 自动同步间隔（毫秒）
  enableVersionBackup: boolean; // 启用版本备份（默认：true）
  autoBackup: boolean; // 自动备份（默认：true）
  backupInterval: number; // 备份间隔（毫秒）
  maxBackupVersions: number; // 最大备份版本数（默认：10）
}
```

## 功能特性

### 1. 智能同步

- **ETag 验证**：基于 ETag 的高效变更检测
- **内容哈希**：确保数据完整性
- **时间戳比较**：自动选择最新版本

### 2. 版本管理

```typescript
// 获取版本历史
const versions = await webdavClient.getVersionHistory(resumeId);

// 恢复到指定版本
await webdavClient.restoreVersion(resumeId, versionId);

// 比较版本差异
const diff = await webdavClient.compareVersions(resumeId, version1, version2);
```

### 3. 批量操作

```typescript
// 批量上传本地简历
const result = await WebDAVBatchOperations.syncAllToWebDAV();

// 批量下载远程简历
const result = await WebDAVBatchOperations.importAllFromWebDAV();

// 双向同步
const result = await WebDAVBatchOperations.bidirectionalSync();
```

### 4. 缓存优化

```typescript
// 预加载缓存
await webdavCache.preload(resumeIds, async (id) => {
  return await webdavClient.getResumeData(id);
});

// 获取缓存统计
const stats = webdavCache.getStats();
```

### 5. 错误恢复

```typescript
// 执行带重试的操作
const result = await webdavRecovery.executeWithRetry(
  () => webdavClient.saveResumeData(resume),
  {
    operationType: "saveResume",
    resumeId: resume.id,
  }
);

// 健康检查
const isHealthy = await webdavRecovery.healthCheck();
```

## API 文档

### WebDAVClient

核心 WebDAV 客户端类，提供所有同步功能。

#### 方法

##### `connect(config: WebDAVConfig): Promise<void>`

连接到 WebDAV 服务器。

##### `smartSave(resumeData: ResumeData, forceSync?: boolean): Promise<void>`

智能保存简历数据，包含版本备份和冲突检测。

##### `getResumeData(resumeId: string): Promise<ResumeData | null>`

获取指定简历的数据。

##### `getAllResumeData(): Promise<Record<string, ResumeData>>`

获取所有简历数据。

##### `deleteResumeFile(resumeId: string): Promise<void>`

删除指定简历文件。

##### `autoSyncAll(): Promise<void>`

自动同步所有简历（页面加载时调用）。

#### 版本管理

##### `getVersionHistory(resumeId: string): Promise<VersionMetadata[]>`

获取简历的版本历史。

##### `restoreVersion(resumeId: string, versionId: string): Promise<void>`

恢复到指定版本。

##### `compareVersions(resumeId: string, version1: string, version2: string): Promise<VersionDiff>`

比较两个版本的差异。

### WebDAVStore

Zustand 状态管理 Store，管理 WebDAV 连接状态和配置。

#### 状态

```typescript
interface WebDAVStore {
  // 配置和连接状态
  config: WebDAVConfig | null;
  isEnabled: boolean;
  isConfigured: boolean;
  isConnected: boolean;

  // 同步状态
  syncStatus: SyncStatus;
  lastSync: Date | null;

  // 版本历史
  versionHistory: VersionMetadata[];
  loadingVersions: boolean;

  // 同步策略
  syncStrategy: SyncStrategy;
}
```

#### 操作方法

```typescript
interface WebDAVStore {
  // 配置管理
  setConfig(config: WebDAVConfig): void;
  connect(config: WebDAVConfig): Promise<void>;
  disconnect(): void;

  // 同步操作
  autoSyncOnLoad(): Promise<void>;
  syncResume(resumeId: string): Promise<void>;
  forceSync(): Promise<void>;

  // 版本管理
  loadVersionHistory(resumeId: string): Promise<void>;
  restoreVersion(resumeId: string, versionId: string): Promise<void>;
  deleteVersion(resumeId: string, versionId: string): Promise<void>;
  compareVersions(resumeId: string, v1: string, v2: string): Promise<void>;
}
```

### 组件 API

#### WebDAVConfig

WebDAV 配置组件，提供用户友好的配置界面。

```tsx
import { WebDAVConfig } from "@/components/ui/webdav-config";

<WebDAVConfig />;
```

#### SyncStatus

同步状态显示组件，支持多种显示模式。

```tsx
import { SyncStatus } from '@/components/ui/sync-status';

<SyncStatus mode="compact" />
<SyncStatus mode="detailed" />
<SyncStatus mode="floating" />
```

#### BatchOperationsPanel

批量操作面板组件。

```tsx
import { BatchOperationsPanel } from "@/components/ui/batch-operations-panel";

<BatchOperationsPanel />;
```

#### VersionHistory

版本历史管理组件。

```tsx
import { VersionHistory } from "@/components/ui/version-history";

<VersionHistory />;
```

## 故障排除

### 常见问题

#### 1. 连接失败

**问题**：无法连接到 WebDAV 服务器

**解决方案**：

- 检查服务器地址是否正确
- 确认用户名和密码正确
- 验证网络连接
- 检查服务器是否支持 HTTPS

#### 2. 同步失败

**问题**：数据同步时出错

**解决方案**：

- 检查网络连接状态
- 验证服务器存储空间
- 查看错误日志获取详细信息
- 尝试手动重新连接

#### 3. 版本冲突

**问题**：出现数据版本冲突

**解决方案**：

- 系统会自动选择最新版本
- 可以通过版本历史手动选择版本
- 如需要，可以手动合并数据

#### 4. 性能问题

**问题**：同步速度慢

**解决方案**：

- 检查网络连接质量
- 使用缓存预加载功能
- 调整同步间隔设置
- 考虑使用批量操作

### 错误代码

| 代码     | 说明         | 解决方案               |
| -------- | ------------ | ---------------------- |
| 401      | 认证失败     | 检查用户名和密码       |
| 403      | 权限不足     | 确认账户有写入权限     |
| 404      | 路径不存在   | 检查服务器地址和路径   |
| 507      | 存储空间不足 | 清理存储空间或升级账户 |
| 网络错误 | 连接失败     | 检查网络连接           |

### 日志查看

在浏览器开发者工具的控制台中查看详细日志：

```javascript
// 查看 WebDAV 相关日志
console.log('WebDAV 日志会以 "WebDAV" 前缀显示');

// 查看缓存统计
console.log(webdavCache.getStats());

// 查看恢复管理器状态
console.log(webdavRecovery.getStatus());
```

## 安全说明

### 数据安全

1. **传输加密**：所有数据传输使用 HTTPS 加密
2. **本地缓存**：敏感数据不会持久缓存在本地
3. **访问控制**：支持基于权限的访问控制
4. **审计日志**：记录所有操作的审计日志

### 隐私保护

1. **数据主权**：您的数据存储在您选择的服务商
2. **端到端控制**：Magic Resume 不会访问您的 WebDAV 数据
3. **可选加密**：支持客户端数据加密（高级功能）

### 最佳实践

1. **使用应用专用密码**：不要使用主账户密码
2. **定期备份**：启用自动版本备份功能
3. **网络安全**：在安全的网络环境下使用
4. **及时更新**：保持 Magic Resume 更新到最新版本

### 服务商选择建议

1. **坚果云**：国内用户推荐，稳定可靠
2. **Nextcloud**：开源自主可控，适合技术用户
3. **商业 WebDAV**：选择知名可信的服务商

## 联系支持

如果您在使用过程中遇到问题：

1. 查看本文档的故障排除部分
2. 检查浏览器控制台的错误日志
3. 联系 Magic Resume 技术支持
4. 在 GitHub 仓库提交 Issue

---

_最后更新：2024 年 12 月_
