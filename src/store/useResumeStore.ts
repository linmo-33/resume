import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BasicInfo,
  Education,
  Experience,
  GlobalSettings,
  Project,
  CustomItem,
  ResumeData,
  MenuSection,
} from "../types/resume";
import { DEFAULT_TEMPLATES } from "@/config";
import {
  initialResumeState,
  initialResumeStateEn,
} from "@/config/initialResumeData";
import { generateUUID } from "@/utils/uuid";
import { webdavClient, WebDAVConfig } from "@/utils/webdav";
import { useWebDAVStore } from "./useWebDAVStore";

interface ResumeStore {
  resumes: Record<string, ResumeData>;
  activeResumeId: string | null;
  activeResume: ResumeData | null;

  createResume: (templateId: string | null) => string;
  deleteResume: (resume: ResumeData) => void;
  duplicateResume: (resumeId: string) => string;
  updateResume: (resumeId: string, data: Partial<ResumeData>) => void;
  setActiveResume: (resumeId: string) => void;
  updateResumeFromFile: (resume: ResumeData) => void;

  updateResumeTitle: (title: string) => void;
  updateBasicInfo: (data: Partial<BasicInfo>) => void;
  updateEducation: (data: Education) => void;
  updateEducationBatch: (educations: Education[]) => void;
  deleteEducation: (id: string) => void;
  updateExperience: (data: Experience) => void;
  updateExperienceBatch: (experiences: Experience[]) => void;
  deleteExperience: (id: string) => void;
  updateProjects: (project: Project) => void;
  updateProjectsBatch: (projects: Project[]) => void;
  deleteProject: (id: string) => void;
  setDraggingProjectId: (id: string | null) => void;
  updateSkillContent: (skillContent: string) => void;
  reorderSections: (newOrder: ResumeData["menuSections"]) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  setActiveSection: (sectionId: string) => void;
  updateMenuSections: (sections: ResumeData["menuSections"]) => void;
  addCustomData: (sectionId: string) => void;
  updateCustomData: (sectionId: string, items: CustomItem[]) => void;
  removeCustomData: (sectionId: string) => void;
  addCustomItem: (sectionId: string) => void;
  updateCustomItem: (
    sectionId: string,
    itemId: string,
    updates: Partial<CustomItem>
  ) => void;
  removeCustomItem: (sectionId: string, itemId: string) => void;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  setThemeColor: (color: string) => void;
  setTemplate: (templateId: string) => void;
  addResume: (resume: ResumeData) => Promise<string>;

  // WebDAV 集成相关方法
  enableWebDAVSync: (enabled: boolean) => void;
  configureWebDAV: (config: WebDAVConfig) => Promise<boolean>;
  syncToWebDAV: (resumeId?: string) => Promise<boolean>;
  initializeWebDAVSync: () => Promise<void>;
  getWebDAVSyncStatus: () => { isEnabled: boolean; status: string };
}

// 智能同步函数 - 仅WebDAV云端同步
const smartSync = async (
  resumeData: ResumeData,
  prevResume?: ResumeData
): Promise<void> => {
  try {
    // 检查是否启用WebDAV同步
    const webdavStore = useWebDAVStore.getState();
    console.log("WebDAV同步状态检查:", {
      isEnabled: webdavStore.isEnabled,
      isConnected: webdavStore.isConnected,
      hasConfig: !!webdavStore.config,
      resumeTitle: resumeData.title,
    });

    if (webdavStore.isEnabled && webdavStore.config) {
      // 确保WebDAV客户端已初始化
      if (!webdavStore.isConnected) {
        console.log("WebDAV未连接，尝试重新连接...");
        const connected = await webdavStore.connect();
        if (!connected) {
          throw new Error("WebDAV连接失败");
        }
      }

      // 检查webdavClient是否已正确初始化
      if (!webdavClient.client && !webdavClient.config) {
        console.log("WebDAV客户端未初始化，正在初始化...");
        const initialized = await webdavClient.initialize(
          webdavStore.config,
          true
        ); // 强制使用代理模式
        if (!initialized) {
          throw new Error("WebDAV客户端初始化失败");
        }
      }

      try {
        // 使用智能保存功能上传JSON文件
        console.log(`开始上传简历JSON文件: "${resumeData.title}"`);
        await webdavClient.smartSave(resumeData);
        console.log(`✅ 简历 "${resumeData.title}" 已成功同步到WebDAV服务器`);
      } catch (error) {
        console.error("WebDAV同步失败:", error);
        throw error; // 没有本地备份，WebDAV失败时抛出错误
      }
    } else {
      console.log(
        `WebDAV未启用或未配置，简历 "${resumeData.title}" 仅保存到浏览器存储`
      );
    }
  } catch (error) {
    console.error("同步失败:", error);
    throw error;
  }
};

export const useResumeStore = create(
  persist<ResumeStore>(
    (set, get) => ({
      resumes: {},
      activeResumeId: null,
      activeResume: null,

      createResume: (templateId = null) => {
        const locale =
          typeof document !== "undefined"
            ? document.cookie
                .split("; ")
                .find((row) => row.startsWith("NEXT_LOCALE="))
                ?.split("=")[1] || "zh"
            : "zh";

        const initialResumeData =
          locale === "en" ? initialResumeStateEn : initialResumeState;

        const id = generateUUID();
        const template = templateId
          ? DEFAULT_TEMPLATES.find((t) => t.id === templateId)
          : DEFAULT_TEMPLATES[0];

        const newResume: ResumeData = {
          ...initialResumeData,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          templateId: template?.id,
          title: `${locale === "en" ? "New Resume" : "新建简历"} ${id.slice(
            0,
            6
          )}`,
        };

        set((state) => ({
          resumes: {
            ...state.resumes,
            [id]: newResume,
          },
          activeResumeId: id,
          activeResume: newResume,
        }));

        // 保留创建简历时的自动同步，确保新建简历能立即同步
        smartSync(newResume).catch((error) => {
          console.error("创建简历时同步失败:", error);
        });

        return id;
      },

      updateResume: (resumeId, data) => {
        set((state) => {
          const resume = state.resumes[resumeId];
          if (!resume) return state;

          const updatedResume = {
            ...resume,
            ...data,
            updatedAt: new Date().toISOString(), // 确保更新时间戳
          };

          // 移除每次更改后的自动同步，改为定时同步和手动保存
          // smartSync(updatedResume, resume).catch((error) => {
          //   console.error("更新简历时同步失败:", error);
          // });

          return {
            resumes: {
              ...state.resumes,
              [resumeId]: updatedResume,
            },
            activeResume:
              state.activeResumeId === resumeId
                ? updatedResume
                : state.activeResume,
          };
        });
      },

      // 从文件更新，直接更新resumes
      updateResumeFromFile: (resume) => {
        set((state) => ({
          resumes: {
            ...state.resumes,
            [resume.id]: resume,
          },
        }));
      },

      updateResumeTitle: (title) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          get().updateResume(activeResumeId, { title });
        }
      },

      deleteResume: (resume) => {
        const resumeId = resume.id;
        set((state) => {
          const { [resumeId]: _, activeResume, ...rest } = state.resumes;
          return {
            resumes: rest,
            activeResumeId: null,
            activeResume: null,
          };
        });

        // 删除WebDAV文件
        (async () => {
          const webdavStore = useWebDAVStore.getState();
          if (webdavStore.isEnabled && webdavStore.isConnected) {
            try {
              // 使用webdavClient的deleteResume方法替代直接调用client.deleteFile
              await webdavClient.deleteResume(resumeId);
              console.log(`已从WebDAV删除简历: ${resume.title}`);
            } catch (error) {
              console.warn("从WebDAV删除简历失败:", error);
            }
          }
        })();
      },

      duplicateResume: (resumeId) => {
        const newId = generateUUID();
        const originalResume = get().resumes[resumeId];

        // 获取当前语言环境
        const locale =
          typeof document !== "undefined"
            ? document.cookie
                .split("; ")
                .find((row) => row.startsWith("NEXT_LOCALE="))
                ?.split("=")[1] || "zh"
            : "zh";

        const duplicatedResume = {
          ...originalResume,
          id: newId,
          title: `${originalResume.title} (${
            locale === "en" ? "Copy" : "复制"
          })`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          resumes: {
            ...state.resumes,
            [newId]: duplicatedResume,
          },
          activeResumeId: newId,
          activeResume: duplicatedResume,
        }));

        // 保留复制简历时的自动同步，确保复制的简历能立即同步
        smartSync(duplicatedResume).catch((error) => {
          console.error("复制简历时同步失败:", error);
        });

        return newId;
      },

      setActiveResume: (resumeId) => {
        const resume = get().resumes[resumeId];
        if (resume) {
          set({ activeResume: resume, activeResumeId: resumeId });
        }
      },

      updateBasicInfo: (data) => {
        set((state) => {
          if (!state.activeResume) return state;

          const updatedResume = {
            ...state.activeResume,
            basic: {
              ...state.activeResume.basic,
              ...data,
            },
          };

          const newState = {
            resumes: {
              ...state.resumes,
              [state.activeResume.id]: updatedResume,
            },
            activeResume: updatedResume,
          };

          // 移除每次更改后的自动同步，改为定时同步和手动保存
          // smartSync(updatedResume, state.activeResume).catch((error) => {
          //   console.error("更新基本信息时同步失败:", error);
          // });

          return newState;
        });
      },

      updateEducation: (education) => {
        const { activeResumeId, resumes } = get();
        if (!activeResumeId) return;

        const currentResume = resumes[activeResumeId];
        const newEducation = currentResume.education.some(
          (e) => e.id === education.id
        )
          ? currentResume.education.map((e) =>
              e.id === education.id ? education : e
            )
          : [...currentResume.education, education];

        get().updateResume(activeResumeId, { education: newEducation });
      },

      updateEducationBatch: (educations) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          get().updateResume(activeResumeId, { education: educations });
        }
      },

      deleteEducation: (id) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const resume = get().resumes[activeResumeId];
          const updatedEducation = resume.education.filter((e) => e.id !== id);
          get().updateResume(activeResumeId, { education: updatedEducation });
        }
      },

      updateExperience: (experience) => {
        const { activeResumeId, resumes } = get();
        if (!activeResumeId) return;

        const currentResume = resumes[activeResumeId];
        const newExperience = currentResume.experience.find(
          (e) => e.id === experience.id
        )
          ? currentResume.experience.map((e) =>
              e.id === experience.id ? experience : e
            )
          : [...currentResume.experience, experience];

        get().updateResume(activeResumeId, { experience: newExperience });
      },

      updateExperienceBatch: (experiences: Experience[]) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const updateData = { experience: experiences };
          get().updateResume(activeResumeId, updateData);
        }
      },
      deleteExperience: (id) => {
        const { activeResumeId, resumes } = get();
        if (!activeResumeId) return;

        const currentResume = resumes[activeResumeId];
        const updatedExperience = currentResume.experience.filter(
          (e) => e.id !== id
        );

        get().updateResume(activeResumeId, { experience: updatedExperience });
      },

      updateProjects: (project) => {
        const { activeResumeId, resumes } = get();
        if (!activeResumeId) return;
        const currentResume = resumes[activeResumeId];
        const newProjects = currentResume.projects.some(
          (p) => p.id === project.id
        )
          ? currentResume.projects.map((p) =>
              p.id === project.id ? project : p
            )
          : [...currentResume.projects, project];

        get().updateResume(activeResumeId, { projects: newProjects });
      },

      updateProjectsBatch: (projects: Project[]) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const updateData = { projects };
          get().updateResume(activeResumeId, updateData);
        }
      },

      deleteProject: (id) => {
        const { activeResumeId } = get();
        if (!activeResumeId) return;
        const currentResume = get().resumes[activeResumeId];
        const updatedProjects = currentResume.projects.filter(
          (p) => p.id !== id
        );
        get().updateResume(activeResumeId, { projects: updatedProjects });
      },

      setDraggingProjectId: (id: string | null) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          get().updateResume(activeResumeId, { draggingProjectId: id });
        }
      },

      updateSkillContent: (skillContent) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          get().updateResume(activeResumeId, { skillContent });
        }
      },

      reorderSections: (newOrder) => {
        const { activeResumeId, resumes } = get();
        if (activeResumeId) {
          const currentResume = resumes[activeResumeId];
          const basicInfoSection = currentResume.menuSections.find(
            (section) => section.id === "basic"
          );
          const reorderedSections = [
            basicInfoSection,
            ...newOrder.filter((section) => section.id !== "basic"),
          ].map((section, index) => ({
            ...section,
            order: index,
          }));
          get().updateResume(activeResumeId, {
            menuSections: reorderedSections as MenuSection[],
          });
        }
      },

      toggleSectionVisibility: (sectionId) => {
        const { activeResumeId, resumes } = get();
        if (activeResumeId) {
          const currentResume = resumes[activeResumeId];
          const updatedSections = currentResume.menuSections.map((section) =>
            section.id === sectionId
              ? { ...section, enabled: !section.enabled }
              : section
          );
          get().updateResume(activeResumeId, { menuSections: updatedSections });
        }
      },

      setActiveSection: (sectionId) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          get().updateResume(activeResumeId, { activeSection: sectionId });
        }
      },

      updateMenuSections: (sections) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          get().updateResume(activeResumeId, { menuSections: sections });
        }
      },

      addCustomData: (sectionId) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const currentResume = get().resumes[activeResumeId];
          const updatedCustomData = {
            ...currentResume.customData,
            [sectionId]: [
              {
                id: generateUUID(),
                title: "未命名模块",
                subtitle: "",
                dateRange: "",
                description: "",
                visible: true,
              },
            ],
          };
          get().updateResume(activeResumeId, { customData: updatedCustomData });
        }
      },

      updateCustomData: (sectionId, items) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const currentResume = get().resumes[activeResumeId];
          const updatedCustomData = {
            ...currentResume.customData,
            [sectionId]: items,
          };
          get().updateResume(activeResumeId, { customData: updatedCustomData });
        }
      },

      removeCustomData: (sectionId) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const currentResume = get().resumes[activeResumeId];
          const { [sectionId]: _, ...rest } = currentResume.customData;
          get().updateResume(activeResumeId, { customData: rest });
        }
      },

      addCustomItem: (sectionId) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const currentResume = get().resumes[activeResumeId];
          const updatedCustomData = {
            ...currentResume.customData,
            [sectionId]: [
              ...(currentResume.customData[sectionId] || []),
              {
                id: generateUUID(),
                title: "未命名模块",
                subtitle: "",
                dateRange: "",
                description: "",
                visible: true,
              },
            ],
          };
          get().updateResume(activeResumeId, { customData: updatedCustomData });
        }
      },

      updateCustomItem: (sectionId, itemId, updates) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const currentResume = get().resumes[activeResumeId];
          const updatedCustomData = {
            ...currentResume.customData,
            [sectionId]: currentResume.customData[sectionId].map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          };
          get().updateResume(activeResumeId, { customData: updatedCustomData });
        }
      },

      removeCustomItem: (sectionId, itemId) => {
        const { activeResumeId } = get();
        if (activeResumeId) {
          const currentResume = get().resumes[activeResumeId];
          const updatedCustomData = {
            ...currentResume.customData,
            [sectionId]: currentResume.customData[sectionId].filter(
              (item) => item.id !== itemId
            ),
          };
          get().updateResume(activeResumeId, { customData: updatedCustomData });
        }
      },

      updateGlobalSettings: (settings: Partial<GlobalSettings>) => {
        const { activeResumeId, updateResume, activeResume } = get();
        if (activeResumeId) {
          updateResume(activeResumeId, {
            globalSettings: {
              ...activeResume?.globalSettings,
              ...settings,
            },
          });
        }
      },

      setThemeColor: (color) => {
        const { activeResumeId, updateResume } = get();
        if (activeResumeId) {
          updateResume(activeResumeId, {
            globalSettings: {
              ...get().activeResume?.globalSettings,
              themeColor: color,
            },
          });
        }
      },

      setTemplate: (templateId) => {
        const { activeResumeId, resumes } = get();
        if (!activeResumeId) return;

        const template = DEFAULT_TEMPLATES.find((t) => t.id === templateId);
        if (!template) return;

        const updatedResume = {
          ...resumes[activeResumeId],
          templateId,
          globalSettings: {
            ...resumes[activeResumeId].globalSettings,
            themeColor: template.colorScheme.primary,
            sectionSpacing: template.spacing.sectionGap,
            paragraphSpacing: template.spacing.itemGap,
            pagePadding: template.spacing.contentPadding,
          },
          basic: {
            ...resumes[activeResumeId].basic,
            layout: template.basic.layout,
          },
        };

        set({
          resumes: {
            ...resumes,
            [activeResumeId]: updatedResume,
          },
          activeResume: updatedResume,
        });
      },
      addResume: async (resume: ResumeData) => {
        // 先检查 WebDAV 状态
        const webdavStore = useWebDAVStore.getState();
        if (
          webdavStore.isEnabled &&
          !webdavStore.isConnected &&
          webdavStore.config
        ) {
          // 尝试重新连接
          await webdavStore.connect();
        }

        set((state) => ({
          resumes: {
            ...state.resumes,
            [resume.id]: resume,
          },
          activeResumeId: resume.id,
        }));

        // 使用智能同步
        if (webdavStore.isEnabled && webdavStore.isConnected) {
          await smartSync(resume);
        }
        return resume.id;
      },

      // WebDAV 集成方法
      enableWebDAVSync: (enabled: boolean) => {
        const webdavStore = useWebDAVStore.getState();
        webdavStore.enableSync(enabled);
      },

      configureWebDAV: async (config: WebDAVConfig): Promise<boolean> => {
        const webdavStore = useWebDAVStore.getState();
        webdavStore.setConfig(config);
        const connected = await webdavStore.connect();

        if (connected) {
          // 连接成功后，尝试初始化同步
          await get().initializeWebDAVSync();
        }

        return connected;
      },

      syncToWebDAV: async (resumeId?: string): Promise<boolean> => {
        const webdavStore = useWebDAVStore.getState();
        if (!webdavStore.isEnabled || !webdavStore.isConnected) {
          console.warn("WebDAV 未启用或未连接");
          return false;
        }

        try {
          if (resumeId) {
            // 同步指定简历
            const resume = get().resumes[resumeId];
            if (resume) {
              await webdavClient.smartSave(resume, true); // 强制同步
              return true;
            }
          } else {
            // 同步所有简历
            const resumes = Object.values(get().resumes);
            for (const resume of resumes) {
              await webdavClient.smartSave(resume, true); // 强制同步
            }
            return true;
          }
        } catch (error) {
          console.error("WebDAV 同步失败:", error);
          return false;
        }
        return false;
      },

      initializeWebDAVSync: async (): Promise<void> => {
        const webdavStore = useWebDAVStore.getState();
        if (!webdavStore.isEnabled || !webdavStore.isConnected) {
          return;
        }

        try {
          // 执行自动同步
          const result = await webdavStore.autoSyncOnLoad();

          if (result) {
            // 同步成功，更新本地简历数据
            const remoteResumes = await webdavStore.loadRemoteResumes();

            // 合并远程简历到本地store
            Object.values(remoteResumes).forEach((remoteResume: any) => {
              const localResume = get().resumes[remoteResume.id];

              if (!localResume) {
                // 新的远程简历，直接添加
                set((state) => ({
                  resumes: {
                    ...state.resumes,
                    [remoteResume.id]: remoteResume,
                  },
                }));
              } else {
                // 比较时间戳，使用最新的版本
                const localTime = new Date(localResume.updatedAt);
                const remoteTime = new Date(remoteResume.updatedAt);

                if (remoteTime > localTime) {
                  // 远程更新，使用远程版本
                  set((state) => ({
                    resumes: {
                      ...state.resumes,
                      [remoteResume.id]: remoteResume,
                    },
                    activeResume:
                      state.activeResumeId === remoteResume.id
                        ? remoteResume
                        : state.activeResume,
                  }));
                }
              }
            });

            console.log("WebDAV 初始化同步完成");
          }
        } catch (error) {
          console.warn("WebDAV 初始化同步失败:", error);
        }
      },

      getWebDAVSyncStatus: () => {
        const webdavStore = useWebDAVStore.getState();
        return {
          isEnabled: webdavStore.isEnabled,
          status: webdavStore.syncStatus.status,
        };
      },
    }),
    {
      name: "resume-storage",
    }
  )
);
