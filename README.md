<div align="center">

# ✨ CV Resume ✨

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-10.0-purple)
![WebDAV](https://img.shields.io/badge/WebDAV-Sync-green)

</div>

CV Resume 是基于[Magic Resume](https://github.com/JOYCEQL/magic-resume)的二次开发版本，在保留原版所有功能的基础上，增加了 WebDAV 云同步功能，支持坚果云等 WebDAV 服务。

## 📸 项目截图

![782shots_so](https://github.com/user-attachments/assets/d59f7582-799c-468d-becf-59ee6453acfd)

## ✨ 特性

- 🚀 基于 Next.js 14+ 构建
- 💫 流畅的动画效果 (Motion)
- 🎨 自定义主题支持
- 🌙 深色模式
- 📤 导出为 PDF
- 🔄 实时预览
- 💾 自动保存
- 🔒 硬盘级存储
- ☁️ **WebDAV 云同步** (新增)
  - 支持坚果云、Nextcloud、ownCloud 等 WebDAV 服务
  - 自动同步简历数据
  - 多设备访问和编辑
  - 批量导入/导出功能
  - 代理模式解决跨域问题

## 🛠️ 技术栈

- Next.js 14+
- TypeScript
- Motion
- Tiptap
- Tailwind CSS
- Zustand
- Shadcn/ui
- Lucide Icons
- WebDAV Client

## 🔄 WebDAV 同步功能

此增强版添加了完整的 WebDAV 同步功能，使您可以：

- 将简历数据安全地存储在自己的 WebDAV 服务上
- 在多个设备间同步和编辑简历
- 通过代理模式解决跨域问题，支持更多 WebDAV 服务
- 批量导入/导出简历
- 保持数据主权和隐私

## 🚀 快速开始

1. 克隆项目

```bash
git clone https://github.com/linmo-33/resume.git
cd magic-resume
```

2. 安装依赖

```bash
pnpm install
```

3. 启动开发服务器

```bash
pnpm dev
```

4. 打开浏览器访问 `http://localhost:3000`

## 📦 构建打包

```bash
pnpm build
```

## ⚡ Vercel 部署

你可以一键部署自己的 Magic Resume WebDAV 增强版实例：

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/linmo-33/resume.git)

## 🐳 Docker 部署

### Docker Compose

1. 确保你已经安装了 Docker 和 Docker Compose

2. 在项目根目录运行：

```bash
docker compose up -d
```

这将会：

- 自动构建应用镜像
- 在后台启动容器

## 📝 开源协议

本项目采用 Apache 2.0 协议，但有一些自定义的部分 - 查看 [LICENSE](LICENSE) 了解详情

## 致谢

- 原项目作者：SiYue
- 原项目主页：https://github.com/JOYCEQL/magic-resume

## 🌟 支持项目

如果这个项目对你有帮助，欢迎点个 star ⭐️
