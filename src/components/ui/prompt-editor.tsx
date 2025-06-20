"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAIConfigStore } from "@/store/useAIConfigStore";
import { POLISH_PROMPT_TEMPLATES } from "@/config/prompts";
import { toast } from "sonner";

export function PromptEditor() {
  const { polishPrompt, setPolishPrompt, resetPolishPrompt } =
    useAIConfigStore();
  const [localPrompt, setLocalPrompt] = useState(polishPrompt);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setPolishPrompt(localPrompt);
      setIsSaving(false);
      toast.success("润色提示词已保存");
    }, 500);
  };

  const handleReset = () => {
    resetPolishPrompt();
    setLocalPrompt(useAIConfigStore.getState().polishPrompt);
    toast.success("已重置为默认提示词");
  };

  const handleTemplateChange = (templateKey: string) => {
    const template =
      POLISH_PROMPT_TEMPLATES[
        templateKey as keyof typeof POLISH_PROMPT_TEMPLATES
      ];
    if (template) {
      setLocalPrompt(template.prompt);
      toast.success(`已切换到${template.name}`);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI润色提示词设置</CardTitle>
        <CardDescription>
          自定义AI润色功能的系统提示词，影响润色效果和风格
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">预设模板</label>
            <Select onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择预设模板" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(POLISH_PROMPT_TEMPLATES).map(
                  ([key, template]) => (
                    <SelectItem key={key} value={key}>
                      {template.name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">提示词内容</label>
            <Textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="输入润色提示词内容..."
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleReset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          重置默认
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            "保存设置"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
