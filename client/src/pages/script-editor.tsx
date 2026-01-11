import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Save,
  RefreshCw,
  FileText,
  ChevronRight,
  History,
  Lightbulb,
  Wand2,
  Clock,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { Project, Script, Scene, ProjectType } from "@shared/schema";
import { projectTypes, projectTypeInfo } from "@shared/schema";

export default function ScriptEditorPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { currentProject, setCurrentProject } = useAppStore();

  const [ideaInput, setIdeaInput] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [selectedType, setSelectedType] = useState<ProjectType>("movie");
  const [targetDuration, setTargetDuration] = useState("60");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("idea");

  const projectId = new URLSearchParams(location.split("?")[1] || "").get("project");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: scripts, isLoading: scriptsLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const { data: scenes } = useQuery<Scene[]>({
    queryKey: ["/api/scenes", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  useEffect(() => {
    if (projectId && projects) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
        setSelectedType(project.type as ProjectType);
      }
    }
  }, [projectId, projects, setCurrentProject]);

  useEffect(() => {
    if (scripts && scripts.length > 0) {
      const activeScript = scripts.find((s) => s.isActive) || scripts[0];
      setScriptContent(activeScript.content);
      setActiveTab("script");
    }
  }, [scripts]);

  const generateScriptMutation = useMutation({
    mutationFn: async (data: { idea: string; type: ProjectType; duration: number; projectId?: string }) => {
      return apiRequest("POST", "/api/scripts/generate", data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scenes"] });
      setIsGenerating(false);
      setGenerationProgress(100);
      toast({
        title: "剧本生成完成",
        description: "AI已为您生成剧本，请查看并编辑",
      });
      setActiveTab("script");
    },
    onError: () => {
      setIsGenerating(false);
      toast({
        title: "生成失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const saveScriptMutation = useMutation({
    mutationFn: async (data: { content: string; projectId: string }) => {
      return apiRequest("POST", "/api/scripts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      toast({
        title: "保存成功",
        description: "剧本已保存",
      });
    },
    onError: () => {
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!ideaInput.trim()) {
      toast({
        title: "请输入创意",
        description: "请先输入您的创意、想法或故事梗概",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

    generateScriptMutation.mutate({
      idea: ideaInput,
      type: selectedType,
      duration: parseInt(targetDuration),
      projectId: currentProject?.id,
    });
  };

  const handleSave = () => {
    if (!currentProject?.id) {
      toast({
        title: "请先选择项目",
        description: "需要选择一个项目来保存剧本",
        variant: "destructive",
      });
      return;
    }

    saveScriptMutation.mutate({
      content: scriptContent,
      projectId: currentProject.id,
    });
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-script-title">剧本编辑</h1>
              {currentProject && (
                <p className="text-sm text-muted-foreground">{currentProject.title}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={currentProject?.id || ""} onValueChange={(id) => {
              const project = projects?.find((p) => p.id === id);
              if (project) setCurrentProject(project);
            }}>
              <SelectTrigger className="w-48" data-testid="select-project">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSave} disabled={saveScriptMutation.isPending} data-testid="button-save-script">
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 pt-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="idea" data-testid="tab-idea">
                    <Lightbulb className="mr-2 h-4 w-4" />
                    创意输入
                  </TabsTrigger>
                  <TabsTrigger value="script" data-testid="tab-script">
                    <FileText className="mr-2 h-4 w-4" />
                    剧本编辑
                  </TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history">
                    <History className="mr-2 h-4 w-4" />
                    版本历史
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="idea" className="flex-1 overflow-auto p-4 mt-0">
                <div className="max-w-3xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI 剧本生成
                      </CardTitle>
                      <CardDescription>
                        输入您的创意、想法或故事梗概，AI将为您生成标准剧本
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">项目类型</label>
                          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ProjectType)}>
                            <SelectTrigger data-testid="select-script-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {projectTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {projectTypeInfo[type]?.nameCN}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">目标时长（分钟）</label>
                          <Select value={targetDuration} onValueChange={setTargetDuration}>
                            <SelectTrigger data-testid="select-duration">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1分钟（短视频）</SelectItem>
                              <SelectItem value="3">3分钟（短片）</SelectItem>
                              <SelectItem value="5">5分钟</SelectItem>
                              <SelectItem value="15">15分钟</SelectItem>
                              <SelectItem value="30">30分钟</SelectItem>
                              <SelectItem value="60">60分钟</SelectItem>
                              <SelectItem value="90">90分钟（电影）</SelectItem>
                              <SelectItem value="120">120分钟</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">创意/想法/故事梗概</label>
                        <Textarea
                          placeholder="描述您的创意、故事梗概、人物设定等。例如：一个关于时间旅行的爱情故事，主角是一位物理学家，在实验中意外穿越到了过去..."
                          className="min-h-[200px] font-mono"
                          value={ideaInput}
                          onChange={(e) => setIdeaInput(e.target.value)}
                          data-testid="input-idea"
                        />
                      </div>

                      {isGenerating && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">AI正在生成剧本...</span>
                            <span>{generationProgress}%</span>
                          </div>
                          <Progress value={generationProgress} />
                        </div>
                      )}

                      <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !ideaInput.trim()}
                        className="w-full"
                        data-testid="button-generate-script"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Wand2 className="mr-2 h-4 w-4" />
                            生成剧本
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="script" className="flex-1 overflow-hidden p-4 mt-0">
                <div className="h-full flex gap-4">
                  <div className="flex-1 flex flex-col">
                    <Textarea
                      placeholder="剧本内容将显示在这里...&#10;&#10;您可以直接编辑剧本，或使用AI生成功能"
                      className="flex-1 min-h-0 font-mono text-sm resize-none"
                      value={scriptContent}
                      onChange={(e) => setScriptContent(e.target.value)}
                      data-testid="textarea-script"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="flex-1 overflow-auto p-4 mt-0">
                <div className="max-w-2xl mx-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle>版本历史</CardTitle>
                      <CardDescription>查看和恢复剧本的历史版本</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {scriptsLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : scripts && scripts.length > 0 ? (
                        <div className="space-y-3">
                          {scripts.map((script, index) => (
                            <div
                              key={script.id}
                              className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer"
                              onClick={() => {
                                setScriptContent(script.content);
                                setActiveTab("script");
                              }}
                              data-testid={`script-version-${script.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                  v{script.version}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">版本 {script.version}</span>
                                    {script.isActive && (
                                      <Badge variant="secondary" className="text-xs">
                                        <Check className="mr-1 h-3 w-3" />
                                        当前
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(script.createdAt).toLocaleString("zh-CN")}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
                          <p className="mt-4 text-muted-foreground">暂无历史版本</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="w-72 border-l overflow-auto hidden lg:block">
            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-medium mb-3">场次列表</h3>
                {scenes && scenes.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {scenes.map((scene) => (
                        <div
                          key={scene.id}
                          className="p-3 border rounded-md hover-elevate cursor-pointer"
                          data-testid={`scene-${scene.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">场次 {scene.sceneNumber}</span>
                            {scene.isInCallSheet && (
                              <Badge variant="secondary" className="text-xs">通告</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {scene.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">生成剧本后将自动提取场次</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  AI 建议
                </h3>
                <Card>
                  <CardContent className="p-3">
                    {scripts?.[0]?.suggestions ? (
                      <p className="text-sm text-muted-foreground">{scripts[0].suggestions}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        生成剧本后，AI将提供优化建议
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
