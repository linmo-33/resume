import { cn } from "@/lib/utils";
import React, { PropsWithChildren } from "react";
import { motion } from "framer-motion";

interface DockProps
  extends PropsWithChildren<React.HTMLAttributes<HTMLDivElement>> {
  className?: string;
}

export function Dock({ children, className, ...props }: DockProps) {
  // Convert children to array to handle them
  const childrenArray = React.Children.toArray(children);

  // Find the index of TemplateSheet for splitting
  const templateSheetIndex = childrenArray.findIndex((child) => {
    if (React.isValidElement(child)) {
      // 简化类型检查，避免深度访问unknown类型
      try {
        const displayName =
          (child.type as any)?.displayName || (child.type as any)?.name;
        return displayName === "TemplateSheet";
      } catch {
        return false;
      }
    }
    return false;
  });

  // If TemplateSheet is not found, render all children in a single group
  if (templateSheetIndex === -1) {
    return (
      <div
        {...props}
        className={cn(
          "flex flex-col items-center gap-4 rounded-xl bg-white/[0.7] p-2 shadow-lg backdrop-blur-md dark:bg-slate-800/[0.7] dark:shadow-slate-900/20",
          className
        )}
      >
        <div className="flex flex-col items-center gap-4">{children}</div>
      </div>
    );
  }

  // Split children into three groups
  const topChildren = childrenArray.slice(0, templateSheetIndex);
  const middleChild = childrenArray[templateSheetIndex];
  const bottomChildren = childrenArray.slice(templateSheetIndex + 1);

  return (
    <div
      {...props}
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl bg-white/[0.7] p-4 shadow-lg backdrop-blur-md dark:bg-slate-800/[0.7] dark:shadow-slate-900/20",
        className
      )}
    >
      {/* Top group */}
      {topChildren.length > 0 && (
        <div className="flex flex-col items-center gap-4">{topChildren}</div>
      )}

      {/* Decorative line */}
      {topChildren.length > 0 && (
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" />
      )}

      {/* Middle (TemplateSheet) */}
      {middleChild}

      {/* Decorative line */}
      {bottomChildren.length > 0 && (
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" />
      )}

      {/* Bottom group */}
      {bottomChildren.length > 0 && (
        <div className="flex flex-col items-center gap-4">{bottomChildren}</div>
      )}
    </div>
  );
}

interface DockIconProps extends PropsWithChildren {
  className?: string;
  onClick?: () => void;
}

export function DockIcon({ children, className, onClick }: DockIconProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm bg-white text-neutral-700 shadow-sm transition-colors hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:shadow-slate-900/20",
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
