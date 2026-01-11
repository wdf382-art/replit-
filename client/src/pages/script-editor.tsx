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
  Upload,
  File,
  ClipboardList,
  ArrowRight,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { Project, Script, Scene, ProjectType, CallSheet, ScriptVersion } from "@shared/schema";
import { projectTypes, projectTypeInfo } from "@shared/schema";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";

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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [extractScenes, setExtractScenes] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [callSheetFile, setCallSheetFile] = useState<File | null>(null);
  const [callSheetTitle, setCallSheetTitle] = useState("");
  const [callSheetText, setCallSheetText] = useState("");
  const [callSheetInputMode, setCallSheetInputMode] = useState<"upload" | "manual">("upload");
  const [isUploadingCallSheet, setIsUploadingCallSheet] = useState(false);
  const [, setLocation] = useLocation();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ScriptVersion | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

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

  const { data: callSheets } = useQuery<CallSheet[]>({
    queryKey: ["/api/call-sheets", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const currentScript = scripts?.[0];

  const { data: scriptVersions } = useQuery<ScriptVersion[]>({
    queryKey: ["/api/scripts", currentScript?.id, "versions"],
    enabled: !!currentScript?.id,
    queryFn: async () => {
      const response = await fetch(`/api/scripts/${currentScript?.id}/versions`);
      if (!response.ok) throw new Error("Failed to fetch versions");
      return response.json();
    },
  });

  const saveVersionMutation = useMutation({
    mutationFn: async (description?: string) => {
      if (!currentScript) return;
      return apiRequest("POST", `/api/scripts/${currentScript.id}/versions`, {
        changeDescription: description || "手动保存版本",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts", currentScript?.id, "versions"] });
      toast({
        title: "版本已保存",
        description: "当前剧本版本已保存到历史记录",
      });
    },
    onError: () => {
      toast({
        title: "保存失败",
        description: "无法保存版本，请稍后重试",
        variant: "destructive",
      });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!currentScript) return;
      return apiRequest("POST", `/api/scripts/${currentScript.id}/versions/${versionId}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scripts", currentScript?.id, "versions"] });
      setConfirmRestore(false);
      setSelectedVersion(null);
      toast({
        title: "版本已恢复",
        description: "剧本已恢复到选定版本",
      });
    },
    onError: () => {
      toast({
        title: "恢复失败",
        description: "无法恢复版本，请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleCallSheetUpload = async () => {
    if (!currentProject?.id || !callSheetTitle.trim()) {
      toast({
        title: "请填写通告单标题",
        description: "请先输入通告单标题",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingCallSheet(true);
    try {
      if (callSheetInputMode === "upload" && callSheetFile) {
        const formData = new FormData();
        formData.append("file", callSheetFile);
        formData.append("projectId", currentProject.id);
        formData.append("title", callSheetTitle);

        const response = await fetch("/api/call-sheets/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Upload failed");
        
        queryClient.invalidateQueries({ queryKey: ["/api/call-sheets"] });
        toast({
          title: "通告单上传成功",
          description: "已自动提取场次信息",
        });
      } else if (callSheetInputMode === "manual" && callSheetText.trim()) {
        await apiRequest("POST", "/api/call-sheets/parse-text", {
          projectId: currentProject.id,
          title: callSheetTitle,
          rawText: callSheetText,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/call-sheets"] });
        toast({
          title: "通告单创建成功",
          description: "已自动提取场次信息",
        });
      }
      
      setCallSheetFile(null);
      setCallSheetTitle("");
      setCallSheetText("");
    } catch (error) {
      toast({
        title: "通告单处理失败",
        description: "请检查文件格式后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCallSheet(false);
    }
  };

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

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "请选择文件",
        description: "请先选择要上传的剧本文件",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    if (currentProject?.id) {
      formData.append("projectId", currentProject.id);
    }
    formData.append("extractScenes", extractScenes.toString());

    try {
      const response = await fetch("/api/scripts/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scenes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

      toast({
        title: "上传成功",
        description: `剧本 "${result.fileName}" 已成功上传`,
      });

      setUploadFile(null);
      setActiveTab("script");
    } catch (error) {
      toast({
        title: "上传失败",
        description: "请检查文件格式后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

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
                  <TabsTrigger value="upload" data-testid="tab-upload">
                    <Upload className="mr-2 h-4 w-4" />
                    上传剧本
                  </TabsTrigger>
                  <TabsTrigger value="script" data-testid="tab-script">
                    <FileText className="mr-2 h-4 w-4" />
                    剧本编辑
                  </TabsTrigger>
                  <TabsTrigger value="history" data-testid="tab-history">
                    <History className="mr-2 h-4 w-4" />
                    版本历史
                  </TabsTrigger>
                  <TabsTrigger value="callsheet" data-testid="tab-callsheet">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    通告单
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
                          <label className="text-sm font-medium">
                            {selectedType === "web_series" ? "单集时长（分钟）" : "目标时长（分钟）"}
                          </label>
                          <Select value={targetDuration} onValueChange={setTargetDuration}>
                            <SelectTrigger data-testid="select-duration">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedType === "web_series" ? (
                                <>
                                  <SelectItem value="15">15分钟/集</SelectItem>
                                  <SelectItem value="20">20分钟/集</SelectItem>
                                  <SelectItem value="30">30分钟/集</SelectItem>
                                  <SelectItem value="45">45分钟/集</SelectItem>
                                  <SelectItem value="60">60分钟/集</SelectItem>
                                </>
                              ) : selectedType === "short_video" || selectedType === "advertisement" ? (
                                <>
                                  <SelectItem value="0.5">30秒</SelectItem>
                                  <SelectItem value="1">1分钟</SelectItem>
                                  <SelectItem value="3">3分钟</SelectItem>
                                  <SelectItem value="5">5分钟</SelectItem>
                                </>
                              ) : selectedType === "mv" ? (
                                <>
                                  <SelectItem value="3">3分钟</SelectItem>
                                  <SelectItem value="4">4分钟</SelectItem>
                                  <SelectItem value="5">5分钟</SelectItem>
                                  <SelectItem value="6">6分钟</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="5">5分钟</SelectItem>
                                  <SelectItem value="15">15分钟</SelectItem>
                                  <SelectItem value="30">30分钟</SelectItem>
                                  <SelectItem value="60">60分钟</SelectItem>
                                  <SelectItem value="90">90分钟</SelectItem>
                                  <SelectItem value="120">120分钟</SelectItem>
                                </>
                              )}
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

              <TabsContent value="upload" className="flex-1 overflow-auto p-4 mt-0">
                <div className="max-w-3xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        上传剧本文件
                      </CardTitle>
                      <CardDescription>
                        上传已有的剧本文件，支持 .txt、.md、.fountain、.docx、.pdf 格式
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate cursor-pointer transition-colors"
                        onClick={() => document.getElementById("file-upload")?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const files = e.dataTransfer.files;
                          if (files.length > 0) {
                            setUploadFile(files[0]);
                          }
                        }}
                        data-testid="dropzone-upload"
                      >
                        <input
                          id="file-upload"
                          type="file"
                          accept=".txt,.md,.fountain,.docx,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              setUploadFile(files[0]);
                            }
                          }}
                          data-testid="input-file-upload"
                        />
                        {uploadFile ? (
                          <div className="space-y-2">
                            <File className="h-12 w-12 mx-auto text-primary" />
                            <p className="font-medium">{uploadFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(uploadFile.size / 1024).toFixed(1)} KB
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadFile(null);
                              }}
                              data-testid="button-clear-file"
                            >
                              清除选择
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                            <p className="font-medium">点击选择或拖拽文件到此处</p>
                            <p className="text-sm text-muted-foreground">
                              支持 .txt、.md、.fountain、.docx、.pdf 格式，最大 10MB
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extract-scenes"
                          checked={extractScenes}
                          onCheckedChange={(checked) => setExtractScenes(checked === true)}
                          data-testid="checkbox-extract-scenes"
                        />
                        <Label htmlFor="extract-scenes" className="cursor-pointer">
                          自动提取场次和角色信息（使用AI分析）
                        </Label>
                      </div>

                      <Button
                        onClick={handleUpload}
                        disabled={!uploadFile || isUploading}
                        className="w-full"
                        data-testid="button-upload-script"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            上传剧本
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

              <TabsContent value="callsheet" className="flex-1 overflow-auto p-4 mt-0">
                <div className="max-w-3xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        通告单管理
                      </CardTitle>
                      <CardDescription>
                        上传或手动输入通告单，系统将自动提取场次信息用于分镜生成
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">通告单标题</label>
                        <Input
                          placeholder="例如：第一集 第1天 通告单"
                          value={callSheetTitle}
                          onChange={(e) => setCallSheetTitle(e.target.value)}
                          data-testid="input-callsheet-title"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant={callSheetInputMode === "upload" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCallSheetInputMode("upload")}
                          data-testid="button-callsheet-upload-mode"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          文件上传
                        </Button>
                        <Button
                          variant={callSheetInputMode === "manual" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCallSheetInputMode("manual")}
                          data-testid="button-callsheet-manual-mode"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          手动输入
                        </Button>
                      </div>

                      {callSheetInputMode === "upload" ? (
                        <div
                          className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors hover:border-primary/50"
                          onClick={() => document.getElementById("callsheet-file-input")?.click()}
                        >
                          <input
                            id="callsheet-file-input"
                            type="file"
                            className="hidden"
                            accept=".txt,.docx,.pdf"
                            onChange={(e) => setCallSheetFile(e.target.files?.[0] || null)}
                          />
                          {callSheetFile ? (
                            <div className="space-y-2">
                              <File className="h-12 w-12 mx-auto text-primary" />
                              <p className="font-medium">{callSheetFile.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(callSheetFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                              <p className="font-medium">点击选择通告单文件</p>
                              <p className="text-sm text-muted-foreground">
                                支持 .txt、.docx、.pdf 格式，最大 5MB
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Textarea
                          placeholder="请粘贴通告单内容，例如：&#10;&#10;场次: 1, 3, 5-8&#10;场景: 法医实验室&#10;演员: 秦明、林涛&#10;..."
                          className="min-h-48"
                          value={callSheetText}
                          onChange={(e) => setCallSheetText(e.target.value)}
                          data-testid="textarea-callsheet"
                        />
                      )}

                      <Button
                        onClick={handleCallSheetUpload}
                        disabled={isUploadingCallSheet || !callSheetTitle.trim() || (callSheetInputMode === "upload" ? !callSheetFile : !callSheetText.trim())}
                        className="w-full"
                        data-testid="button-submit-callsheet"
                      >
                        {isUploadingCallSheet ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            处理中...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            保存通告单
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {callSheets && callSheets.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">已保存的通告单</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {callSheets.map((sheet) => (
                            <div
                              key={sheet.id}
                              className="flex items-center justify-between p-3 border rounded-md"
                              data-testid={`callsheet-item-${sheet.id}`}
                            >
                              <div>
                                <p className="font-medium">{sheet.title}</p>
                                {sheet.sceneNumbers && sheet.sceneNumbers.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    场次: {sheet.sceneNumbers.join(", ")}
                                  </p>
                                )}
                              </div>
                              <Badge variant="secondary">
                                {sheet.sceneNumbers?.length || 0} 场
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="w-72 border-l overflow-auto hidden lg:block">
            <div className="p-4 space-y-4">
              {scenes && scenes.length > 0 && (
                <Button
                  className="w-full"
                  onClick={() => setLocation("/storyboard")}
                  data-testid="button-next-step"
                >
                  下一步：生成分镜
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}

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

              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  版本历史
                </h3>
                {currentScript ? (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => saveVersionMutation.mutate()}
                      disabled={saveVersionMutation.isPending}
                      data-testid="button-save-version"
                    >
                      {saveVersionMutation.isPending ? (
                        <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-3 w-3" />
                      )}
                      保存当前版本
                    </Button>
                    
                    {scriptVersions && scriptVersions.length > 0 ? (
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {scriptVersions.map((version) => (
                            <div
                              key={version.id}
                              className="p-2 border rounded-md hover-elevate cursor-pointer text-sm"
                              onClick={() => {
                                setSelectedVersion(version);
                                setConfirmRestore(true);
                              }}
                              data-testid={`version-${version.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs">
                                  v{version.version}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(version.createdAt), "MM/dd HH:mm")}
                                </span>
                              </div>
                              {version.changeDescription && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {version.changeDescription}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        暂无版本历史
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    生成剧本后可保存版本
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复版本</DialogTitle>
            <DialogDescription>
              您确定要将剧本恢复到版本 v{selectedVersion?.version} 吗？当前版本将自动保存到历史记录中。
            </DialogDescription>
          </DialogHeader>
          {selectedVersion && (
            <div className="border rounded-md p-3 bg-muted/50 max-h-48 overflow-auto">
              <p className="text-sm font-mono whitespace-pre-wrap line-clamp-6">
                {selectedVersion.content.substring(0, 500)}
                {selectedVersion.content.length > 500 && "..."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(false)}>
              取消
            </Button>
            <Button
              onClick={() => selectedVersion && restoreVersionMutation.mutate(selectedVersion.id)}
              disabled={restoreVersionMutation.isPending}
              data-testid="button-confirm-restore"
            >
              {restoreVersionMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
