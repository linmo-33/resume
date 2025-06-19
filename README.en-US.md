<div align="center">

# ✨ Magic Resume - WebDAV Enhanced Edition ✨

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-10.0-purple)
![WebDAV](https://img.shields.io/badge/WebDAV-Sync-green)

[简体中文](./README.md) | English

</div>

Magic Resume WebDAV Enhanced Edition is a fork of [Magic Resume](https://github.com/JOYCEQL/magic-resume) that adds WebDAV cloud synchronization functionality while preserving all original features. It supports Nutstore, Nextcloud, ownCloud, and other WebDAV services.

## 📸 Screenshots

![782shots_so](https://github.com/user-attachments/assets/d59f7582-799c-468d-becf-59ee6453acfd)

## ✨ Features

- 🚀 Built with Next.js 14+
- 💫 Smooth animations (Motion)
- 🎨 Custom theme support
- 🌙 Dark mode
- 📤 Export to PDF
- 🔄 Real-time preview
- 💾 Auto-save
- 🔒 Disk-level storage
- ☁️ **WebDAV Cloud Sync** (New)
  - Support for Nutstore, Nextcloud, ownCloud, and other WebDAV services
  - Automatic resume data synchronization
  - Multi-device access and editing
  - Batch import/export functionality
  - Proxy mode to solve CORS issues

## 🛠️ Tech Stack

- Next.js 14+
- TypeScript
- Motion
- Tiptap
- Tailwind CSS
- Zustand
- Shadcn/ui
- Lucide Icons
- WebDAV Client

## 🔄 WebDAV Sync Feature

This enhanced version adds complete WebDAV synchronization functionality, allowing you to:

- Securely store your resume data on your own WebDAV service
- Synchronize and edit resumes across multiple devices
- Solve CORS issues with proxy mode, supporting more WebDAV services
- Batch import/export resumes
- Maintain data sovereignty and privacy

## 🚀 Quick Start

1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd magic-resume
```

2. Install dependencies

```bash
pnpm install
```

3. Start the development server

```bash
pnpm dev
```

4. Open your browser and visit `http://localhost:3000`

## 📦 Build

```bash
pnpm build
```

## ⚡ Deploy on Vercel

You can deploy your own Magic Resume WebDAV Enhanced Edition instance with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=<YOUR_REPOSITORY_URL>)

## 🐳 Docker Deployment

### Docker Compose

1. Make sure you have Docker and Docker Compose installed

2. Run the following command in the project root:

```bash
docker compose up -d
```

This will:

- Automatically build the application image
- Start the container in the background

## 📝 License

This project is licensed under the Apache 2.0 License with some custom parts - see the [LICENSE](LICENSE) file for details.

## 🗺️ Roadmap

- [x] AI-assisted writing
- [x] Multi-language support
- [x] **WebDAV Cloud Sync** (Implemented)
- [ ] More resume templates
- [ ] More export formats
- [ ] Custom models
- [ ] Smart single-page
- [ ] Import from PDF, Markdown, etc.

## 📞 Contact

- Original project author: SiYue
- Original project homepage: https://github.com/JOYCEQL/magic-resume

## 🌟 Support

If this project helped you, please consider giving it a star ⭐️ 