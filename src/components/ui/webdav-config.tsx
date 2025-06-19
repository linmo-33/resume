"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useWebDAVStore } from "@/store/useWebDAVStore";
import { WebDAVConfig } from "@/utils/webdav";
import { Loader2, CheckCircle, XCircle, Info } from "lucide-react";

// 预设的 WebDAV 服务商配置
const WEBDAV_PRESETS = {
  jianguoyun: {
    name: "坚果云",
    description: "国内访问速度快，WebDAV 支持完善",
    serverUrl: "https://dav.jianguoyun.com/dav/",
    defaultBasePath: "/resume/",
    authInfo: "使用坚果云账号和应用密码",
  },
  custom: {
    name: "自定义",
    description: "配置其他 WebDAV 兼容服务",
    serverUrl: "",
    defaultBasePath: "/",
    authInfo: "根据服务商要求填写认证信息",
  },
};

interface WebDAVConfigProps {
  onConfigSaved?: (config: WebDAVConfig) => void;
}

export function WebDAVConfigComponent({ onConfigSaved }: WebDAVConfigProps) {
  const {
    config: savedConfig,
    setConfig,
    testConnection,
    connect,
    isConnected,
    isEnabled,
    enableSync,
  } = useWebDAVStore();

  const [selectedProvider, setSelectedProvider] =
    useState<string>("jianguoyun");
  const [config, setConfigState] = useState<WebDAVConfig>({
    serverUrl: WEBDAV_PRESETS.jianguoyun.serverUrl,
    username: "",
    password: "",
    basePath: WEBDAV_PRESETS.jianguoyun.defaultBasePath,
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [connectionError, setConnectionError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // 当选择预设服务商时更新配置
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const preset = WEBDAV_PRESETS[provider as keyof typeof WEBDAV_PRESETS];
    setConfigState((prev) => ({
      ...prev,
      serverUrl: preset.serverUrl,
      basePath: preset.defaultBasePath,
    }));
    setConnectionStatus("idle");
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!config.serverUrl || !config.username || !config.password) {
      setConnectionError("请填写完整的服务器信息");
      setConnectionStatus("error");
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus("idle");

    try {
      const success = await testConnection(config);
      if (success) {
        setConnectionStatus("success");
        setConnectionError("");
      } else {
        setConnectionStatus("error");
        setConnectionError("连接失败，请检查服务器地址和认证信息");
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionError(
        error instanceof Error ? error.message : "连接测试失败"
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  // 保存配置并连接
  const handleSaveConfig = async () => {
    if (connectionStatus !== "success") {
      await handleTestConnection();
      return;
    }

    setIsSaving(true);
    try {
      // 保存配置
      setConfig(config);

      // 建立连接
      const connected = await connect();

      if (connected) {
        // 自动启用WebDAV同步
        enableSync(true);
        console.log("WebDAV配置已保存并启用同步");
        onConfigSaved?.(config);
      } else {
        throw new Error("连接失败，请检查配置");
      }
    } catch (error) {
      console.error("保存配置失败:", error);
      setConnectionStatus("error");
      setConnectionError(
        error instanceof Error ? error.message : "保存配置失败"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 切换WebDAV启用状态
  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      if (enabled && !isConnected) {
        // 如果要启用但未连接，先尝试连接
        const connected = await connect();
        if (!connected) {
          return;
        }
      }

      enableSync(enabled);
    } catch (error) {
      console.error("切换WebDAV状态失败:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* WebDAV 服务商选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择 WebDAV 服务</CardTitle>
          <CardDescription>
            选择您的 WebDAV 服务提供商，或配置自定义服务器
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(WEBDAV_PRESETS).map(([key, preset]) => (
              <Card
                key={key}
                className={`cursor-pointer transition-colors ${
                  selectedProvider === key
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => handleProviderChange(key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{preset.name}</h3>
                    {selectedProvider === key && (
                      <Badge variant="default">已选择</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {preset.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 配置表单 */}
      <Card>
        <CardHeader>
          <CardTitle>服务器配置</CardTitle>
          <CardDescription>
            {
              WEBDAV_PRESETS[selectedProvider as keyof typeof WEBDAV_PRESETS]
                ?.authInfo
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serverUrl">服务器地址</Label>
            <Input
              id="serverUrl"
              placeholder="https://dav.example.com/dav/"
              value={config.serverUrl}
              onChange={(e) =>
                setConfigState((prev) => ({
                  ...prev,
                  serverUrl: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                placeholder="your-username"
                value={config.username}
                onChange={(e) =>
                  setConfigState((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="your-password"
                value={config.password}
                onChange={(e) =>
                  setConfigState((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePath">同步目录</Label>
            <Input
              id="basePath"
              placeholder="/魔方简历/"
              value={config.basePath}
              onChange={(e) =>
                setConfigState((prev) => ({
                  ...prev,
                  basePath: e.target.value,
                }))
              }
            />
            <p className="text-sm text-muted-foreground">
              简历文件将保存在此目录下
            </p>
          </div>

          {/* 连接状态提示 */}
          {connectionStatus === "error" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}

          {connectionStatus === "success" && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>连接测试成功！</AlertDescription>
            </Alert>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTestingConnection || isSaving}
              className="flex-1"
            >
              {isTestingConnection && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              测试连接
            </Button>

            <Button
              onClick={handleSaveConfig}
              disabled={isTestingConnection || isSaving}
              className="flex-1"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connectionStatus === "success" ? "保存配置" : "测试并保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WebDAV启用状态控制 */}
      {savedConfig && (
        <Card>
          <CardHeader>
            <CardTitle>WebDAV同步控制</CardTitle>
            <CardDescription>启用或禁用WebDAV云端同步功能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">启用WebDAV同步</Label>
                <p className="text-sm text-muted-foreground">
                  {isEnabled ? "已启用云端同步" : "已禁用云端同步"}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={!savedConfig || (!isConnected && !isEnabled)}
              />
            </div>

            <div className="flex items-center space-x-2">
              {isConnected ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">
                    已连接到 {savedConfig.serverUrl}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">未连接</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 帮助信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>配置说明</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-medium">坚果云配置说明：</h4>
            <p className="text-sm text-muted-foreground">
              1. 登录坚果云网页版，进账户信息→ 安全选项
              <br />
              2. 生成应用密码用于 WebDAV 连接
              <br />
              3. 服务器地址：https://dav.jianguoyun.com/dav/
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 默认导出
export default WebDAVConfigComponent;

// 兼容性导出
export { WebDAVConfigComponent as WebDAVConfig };
