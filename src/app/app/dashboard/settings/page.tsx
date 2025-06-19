"use client";
import { useState, useEffect } from "react";
import { Cloud, Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebDAVConfig } from "@/components/ui/webdav-config";
import { BatchOperationsPanel } from "@/components/ui/batch-operations-panel";
import { SyncStatus } from "@/components/ui/sync-status";
import { useWebDAVStore } from "@/store/useWebDAVStore";

const SettingsPage = () => {
  const t = useTranslations();

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          {t("dashboard.settings.title")}
        </h2>
        <SyncStatus mode="compact" />
      </div>

      <Tabs defaultValue="webdav" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="webdav" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            云端同步
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            批量操作
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webdav" className="space-y-6">
          <WebDAVConfig />
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchOperationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
