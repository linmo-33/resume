"use client";
import { useTranslations } from "next-intl";
import { AlertCircle, Save } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import PdfExport from "../shared/PdfExport";
import ThemeToggle from "../shared/ThemeToggle";
import { useResumeStore } from "@/store/useResumeStore";
import { getThemeConfig } from "@/theme/themeConfig";
import { useGrammarCheck } from "@/hooks/useGrammarCheck";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useState } from "react";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorHeaderProps {
  isMobile?: boolean;
}

export function EditorHeader({ isMobile }: EditorHeaderProps) {
  const { activeResume, setActiveSection, updateResumeTitle } =
    useResumeStore();
  const { menuSections = [], activeSection } = activeResume || {};
  const themeConfig = getThemeConfig();
  const { errors, selectError } = useGrammarCheck();
  const { manualSync, lastSync } = useAutoSync();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const visibleSections = menuSections
    ?.filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order);

  // 手动保存处理函数
  const handleSave = async () => {
    if (!activeResume) return;

    setIsSaving(true);
    try {
      await manualSync();
      // 显示保存成功状态1秒
      setTimeout(() => setIsSaving(false), 1000);
    } catch (error) {
      console.error("手动保存失败:", error);
      setIsSaving(false);
    }
  };

  return (
    <motion.header
      className={`h-16 border-b sticky top-0 z-10`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
    >
      <div className="flex items-center justify-between px-6 h-full pr-2">
        <div className="flex items-center space-x-6  scrollbar-hide">
          <motion.div
            className="flex items-center space-x-2 shrink-0 cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              router.push("/app/dashboard");
            }}
          >
            <span className="text-lg font-semibold">{t("common.title")}</span>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          </motion.div>
        </div>

        <div className="flex items-center space-x-3">
          {errors.length > 0 && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <div className="flex items-center space-x-1 cursor-pointer">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-500">
                    发现 {errors.length} 个问题
                  </span>
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">语法检查结果</h4>
                  <div className="space-y-1">
                    {errors.map((error, index) => (
                      <div key={index} className="text-sm space-y-1">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p>{error.error}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => selectError(index)}
                              >
                                定位
                              </Button>
                            </div>
                            {error.suggestion && (
                              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <p className="text-sm font-medium">
                                  建议修改：
                                </p>
                                <p className="text-sm">{error.suggestion}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
          <Input
            defaultValue={activeResume?.title || ""}
            onBlur={(e) => {
              updateResumeTitle(e.target.value || "未命名简历");
            }}
            className="w-60  text-sm hidden md:block"
            placeholder="简历名称"
          />

          {/* 保存按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="relative"
                >
                  <Save
                    className={`h-5 w-5 ${isSaving ? "text-green-500" : ""}`}
                  />
                  {isSaving && (
                    <span className="absolute top-0 right-0 h-2 w-2 bg-green-500 rounded-full animate-ping" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  保存简历
                  {lastSync
                    ? `（上次：${new Date(lastSync).toLocaleTimeString()}）`
                    : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ThemeToggle></ThemeToggle>
          <div className="md:flex items-center ">
            <PdfExport />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
