import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileDown,
  Check,
  Loader2,
  Film,
  Image,
  Drama,
  Shirt,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { Project, Scene } from "@shared/schema";

type ExportFormat = "pdf" | "excel" | "word";

interface ExportModule {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const exportModules: ExportModule[] = [
  { id: "script", name: "剧本", icon: <FileText className="h-4 w-4" />, description: "完整剧本内容" },
  { id: "storyboard", name: "分镜头", icon: <Image className="h-4 w-4" />, description: "分镜图及镜头参数" },
  { id: "performance", name: "表演指导", icon: <Drama className="h-4 w-4" />, description: "角色表演提示" },
  { id: "production", name: "服化道", icon: <Shirt className="h-4 w-4" />, description: "服装化妆道具提示" },
  { id: "analysis", name: "戏剧分析", icon: <Sparkles className="h-4 w-4" />, description: "戏点和转场设计" },
];

export default function ExportPage() {
  const { toast } = useToast();
  const { currentProject, setCurrentProject } = useAppStore();

  const [selectedModules, setSelectedModules] = useState<string[]>(["script", "storyboard"]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [includeVersions, setIncludeVersions] = useState(true);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: scenes } = useQuery<Scene[]>({
    queryKey: ["/api/scenes", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const toggleScene = (sceneId: string) => {
    setSelectedScenes((prev) =>
      prev.includes(sceneId)
        ? prev.filter((id) => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  const selectAllScenes = () => {
    if (scenes) {
      setSelectedScenes(scenes.map((s) => s.id));
    }
  };

  const deselectAllScenes = () => {
    setSelectedScenes([]);
  };

  const exportMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      modules: string[];
      format: ExportFormat;
      sceneIds: string[];
      includeVersions: boolean;
    }) => {
      const response = await apiRequest<{ success?: boolean; data?: Record<string, unknown>; projectTitle?: string; url?: string }>("POST", "/api/export", data);
      return response;
    },
    onSuccess: (response) => {
      setIsExporting(false);
      setExportProgress(100);
      
      if (response?.url) {
        window.open(response.url, "_blank");
        toast({
          title: "导出完成",
          description: "文件已准备就绪",
        });
      } else if (response?.success && response?.data) {
        const jsonStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${response.projectTitle || currentProject?.title || "export"}_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "导出完成",
          description: "文件已下载到本地",
        });
      } else {
        toast({
          title: "导出成功",
          description: "数据已准备完成",
        });
      }
    },
    onError: (error: Error) => {
      setIsExporting(false);
      toast({
        title: "导出失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (!currentProject) {
      toast({
        title: "请选择项目",
        description: "需要选择一个项目进行导出",
        variant: "destructive",
      });
      return;
    }

    if (selectedModules.length === 0) {
      toast({
        title: "请选择导出内容",
        description: "至少选择一个模块进行导出",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    const progressInterval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 15;
      });
    }, 400);

    exportMutation.mutate({
      projectId: currentProject.id,
      modules: selectedModules,
      format: exportFormat,
      sceneIds: selectedScenes.length > 0 ? selectedScenes : (scenes?.map((s) => s.id) || []),
      includeVersions,
    });
  };

  const formatInfo: Record<ExportFormat, { name: string; icon: React.ReactNode; description: string }> = {
    pdf: { name: "PDF", icon: <FileText className="h-5 w-5" />, description: "通用格式，适合打印和分享" },
    excel: { name: "Excel", icon: <FileSpreadsheet className="h-5 w-5" />, description: "表格格式，方便编辑和数据处理" },
    word: { name: "Word", icon: <FileDown className="h-5 w-5" />, description: "文档格式，便于后续编辑" },
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-export-title">
            导出中心
          </h1>
          <p className="text-muted-foreground">
            将项目资料整合导出为统一文档
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>选择项目</CardTitle>
                <CardDescription>选择要导出的项目</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={currentProject?.id || ""} onValueChange={(id) => {
                  const project = projects?.find((p) => p.id === id);
                  if (project) {
                    setCurrentProject(project);
                    setSelectedScenes([]);
                  }
                }}>
                  <SelectTrigger data-testid="select-project-export">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4" />
                          {project.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>导出内容</CardTitle>
                <CardDescription>选择要包含在导出文件中的模块</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {exportModules.map((module) => (
                    <div
                      key={module.id}
                      onClick={() => toggleModule(module.id)}
                      className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                        selectedModules.includes(module.id)
                          ? "border-primary bg-primary/5"
                          : "hover-elevate"
                      }`}
                      data-testid={`module-${module.id}`}
                    >
                      <Checkbox
                        checked={selectedModules.includes(module.id)}
                        onCheckedChange={() => toggleModule(module.id)}
                      />
                      <div className="flex items-center gap-2">
                        {module.icon}
                        <div>
                          <span className="font-medium text-sm">{module.name}</span>
                          <p className="text-xs text-muted-foreground">{module.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {scenes && scenes.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>选择场次</CardTitle>
                      <CardDescription>选择要导出的具体场次（不选则导出全部）</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllScenes}>
                        全选
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllScenes}>
                        取消
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {scenes.map((scene) => (
                        <div
                          key={scene.id}
                          onClick={() => toggleScene(scene.id)}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                            selectedScenes.includes(scene.id)
                              ? "bg-primary/5"
                              : "hover-elevate"
                          }`}
                          data-testid={`scene-export-${scene.id}`}
                        >
                          <Checkbox
                            checked={selectedScenes.includes(scene.id)}
                            onCheckedChange={() => toggleScene(scene.id)}
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <Badge variant="secondary" className="text-xs">
                              #{scene.sceneNumber}
                            </Badge>
                            <span className="text-sm truncate">{scene.title}</span>
                          </div>
                          {scene.isInCallSheet && (
                            <Badge variant="outline" className="text-xs">通告</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>导出格式</CardTitle>
                <CardDescription>选择导出文件的格式</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={exportFormat}
                  onValueChange={(v) => setExportFormat(v as ExportFormat)}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {(Object.keys(formatInfo) as ExportFormat[]).map((format) => (
                    <div key={format}>
                      <RadioGroupItem
                        value={format}
                        id={format}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={format}
                        className="flex flex-col items-center justify-center p-4 border rounded-md cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover-elevate"
                        data-testid={`format-${format}`}
                      >
                        {formatInfo[format].icon}
                        <span className="mt-2 font-medium">{formatInfo[format].name}</span>
                        <span className="text-xs text-muted-foreground text-center mt-1">
                          {formatInfo[format].description}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>版本选项</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="includeVersions"
                    checked={includeVersions}
                    onCheckedChange={(checked) => setIncludeVersions(!!checked)}
                  />
                  <Label htmlFor="includeVersions" className="cursor-pointer">
                    包含历史版本（新旧版本在同一文档中标注）
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>导出预览</CardTitle>
                <CardDescription>确认导出内容</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentProject ? (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground">项目</div>
                      <div className="font-medium">{currentProject.title}</div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">包含模块</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedModules.length > 0 ? (
                          selectedModules.map((moduleId) => {
                            const module = exportModules.find((m) => m.id === moduleId);
                            return module ? (
                              <Badge key={moduleId} variant="secondary" className="text-xs">
                                {module.name}
                              </Badge>
                            ) : null;
                          })
                        ) : (
                          <span className="text-sm text-muted-foreground">未选择</span>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-sm text-muted-foreground">场次数量</div>
                      <div className="font-medium">
                        {selectedScenes.length > 0 ? `${selectedScenes.length} 场` : "全部场次"}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-sm text-muted-foreground">导出格式</div>
                      <div className="font-medium flex items-center gap-2">
                        {formatInfo[exportFormat].icon}
                        {formatInfo[exportFormat].name}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm">
                      {includeVersions ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <span className={includeVersions ? "" : "text-muted-foreground"}>
                        包含历史版本
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    请先选择项目
                  </div>
                )}
              </CardContent>
              <CardContent className="pt-0">
                {isExporting && (
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">正在生成文档...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <Progress value={exportProgress} />
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={handleExport}
                  disabled={isExporting || !currentProject || selectedModules.length === 0}
                  data-testid="button-export"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      导出中...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      生成并导出
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
