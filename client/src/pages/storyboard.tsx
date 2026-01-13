import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Image,
  Wand2,
  RefreshCw,
  Grid3X3,
  List,
  Download,
  Settings2,
  ChevronDown,
  Plus,
  Film,
  Camera,
  Move,
  Eye,
  Sparkles,
  Check,
  FileText,
  ClipboardList,
  Trash2,
  Video,
  Play,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { Project, Scene, Shot, DirectorStyle, VisualStyle, ShotType, CameraAngle, CameraMovement, AspectRatio, ShotVersion, CallSheet, VideoModel } from "@shared/schema";
import {
  directorStyles,
  directorStyleInfo,
  visualStyles,
  visualStyleInfo,
  shotTypes,
  shotTypeInfo,
  cameraAngles,
  cameraAngleInfo,
  cameraMovements,
  cameraMovementInfo,
  aspectRatios,
  videoModels,
  videoModelInfo,
} from "@shared/schema";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { History, Save, ImagePlus, Loader2 } from "lucide-react";

export default function StoryboardPage() {
  const { toast } = useToast();
  const { currentProject, setCurrentProject } = useAppStore();
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedDirectorStyle, setSelectedDirectorStyle] = useState<DirectorStyle | "custom">("christopher_nolan");
  const [customDirectorStyle, setCustomDirectorStyle] = useState("");
  const [selectedVisualStyle, setSelectedVisualStyle] = useState<VisualStyle | "custom">("cinematic");
  const [customVisualStyle, setCustomVisualStyle] = useState("");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("16:9");
  const [customAspectRatio, setCustomAspectRatio] = useState("");
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [shotEdits, setShotEdits] = useState<Partial<Shot>>({});
  const [showShotVersions, setShowShotVersions] = useState(false);
  const [selectedShotVersion, setSelectedShotVersion] = useState<ShotVersion | null>(null);
  const [confirmRestoreShot, setConfirmRestoreShot] = useState(false);
  const [showCallSheetDialog, setShowCallSheetDialog] = useState(false);
  const [callSheetTitle, setCallSheetTitle] = useState("");
  const [callSheetText, setCallSheetText] = useState("");
  const [isUploadingCallSheet, setIsUploadingCallSheet] = useState(false);
  const [showSceneDetails, setShowSceneDetails] = useState(false);
  const [showCreateSceneDialog, setShowCreateSceneDialog] = useState(false);
  const [newSceneNumber, setNewSceneNumber] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [selectedCallSheetId, setSelectedCallSheetId] = useState<string | null>(null);
  const [scenePreview, setScenePreview] = useState<{
    found: boolean;
    message: string;
    title: string | null;
    location: string | null;
    timeOfDay: string | null;
    description: string | null;
    dialogue: string | null;
    action: string | null;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState(0);
  const [storyboardViewType, setStoryboardViewType] = useState<"image" | "text" | "video">("image");
  const [selectedVideoModel, setSelectedVideoModel] = useState<VideoModel>("veo");
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [isGeneratingAllVideos, setIsGeneratingAllVideos] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: scenes } = useQuery<Scene[]>({
    queryKey: ["/api/scenes", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const { data: shots, isLoading: shotsLoading } = useQuery<Shot[]>({
    queryKey: ["/api/shots", selectedScene?.id, selectedDirectorStyle],
    queryFn: async () => {
      if (!selectedScene?.id) return [];
      const params = new URLSearchParams({ sceneId: selectedScene.id });
      if (selectedDirectorStyle) {
        params.append("directorStyle", selectedDirectorStyle);
      }
      const res = await fetch(`/api/shots?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch shots");
      return res.json();
    },
    enabled: !!selectedScene?.id,
  });

  // Check if any shots are currently generating videos - poll main query for updates
  const hasGeneratingVideos = shots?.some(s => s.videoStatus === "generating");
  
  // Effect to poll for video status updates
  useEffect(() => {
    if (!hasGeneratingVideos || !selectedScene?.id) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots", selectedScene?.id, selectedDirectorStyle] });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [hasGeneratingVideos, selectedScene?.id, selectedDirectorStyle]);

  const { data: callSheets } = useQuery<CallSheet[]>({
    queryKey: ["/api/call-sheets", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const filteredScenes = scenes?.filter((scene) => {
    if (!selectedCallSheetId) return true;
    const callSheet = callSheets?.find((cs) => cs.id === selectedCallSheetId);
    return callSheet?.sceneNumbers?.includes(scene.sceneNumber);
  });

  useEffect(() => {
    if (scenes && scenes.length > 0) {
      // If no scene selected or selected scene no longer exists in the list, select first one
      if (!selectedScene || !scenes.find(s => s.id === selectedScene.id)) {
        setSelectedScene(scenes[0]);
      }
    } else if (scenes && scenes.length === 0) {
      setSelectedScene(null);
    }
  }, [scenes, selectedScene]);

  const generateShotsMutation = useMutation({
    mutationFn: async (data: { 
      sceneId: string; 
      directorStyle: string;
      customDirectorStyle?: string;
      visualStyle: string;
      customVisualStyle?: string;
      aspectRatio: string;
      customAspectRatio?: string;
    }) => {
      return apiRequest("POST", "/api/shots/generate", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      setIsGenerating(false);
      setGenerationProgress(100);
      toast({
        title: "分镜生成完成",
        description: "AI已为您生成分镜，点击可编辑调整",
      });
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

  const updateShotMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Shot> }) => {
      return apiRequest("PATCH", `/api/shots/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shots", editingShotId, "versions"] });
      setEditingShotId(null);
      setShotEdits({});
      toast({
        title: "更新成功",
        description: "分镜已更新",
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  // Generate image for a single shot
  const generateShotImageMutation = useMutation({
    mutationFn: async (shotId: string) => {
      setGeneratingImageId(shotId);
      return apiRequest("POST", `/api/shots/${shotId}/generate-image`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      setGeneratingImageId(null);
      toast({
        title: "图片生成完成",
        description: "分镜图片已生成",
      });
    },
    onError: () => {
      setGeneratingImageId(null);
      toast({
        title: "生成失败",
        description: "图片生成失败，请稍后重试",
        variant: "destructive",
      });
    },
  });

  // Generate images for all shots in the scene
  const generateAllImagesMutation = useMutation({
    mutationFn: async (sceneId: string) => {
      setIsGeneratingAllImages(true);
      setImageGenProgress(0);
      return apiRequest("POST", `/api/scenes/${sceneId}/generate-all-images`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      setIsGeneratingAllImages(false);
      setImageGenProgress(100);
      toast({
        title: "批量图片生成完成",
        description: `成功生成 ${data.totalGenerated} 张图片`,
      });
    },
    onError: () => {
      setIsGeneratingAllImages(false);
      toast({
        title: "批量生成失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  // Generate video for a single shot (async - returns immediately)
  const generateShotVideoMutation = useMutation({
    mutationFn: async ({ shotId, model }: { shotId: string; model: VideoModel }) => {
      setGeneratingVideoId(shotId);
      return apiRequest("POST", `/api/shots/${shotId}/generate-video`, { model });
    },
    onSuccess: () => {
      // Async job started - refresh to show "generating" status
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      setGeneratingVideoId(null);
      toast({
        title: "视频生成已开始",
        description: "后台正在生成视频，完成后会自动更新",
      });
    },
    onError: (error: any) => {
      setGeneratingVideoId(null);
      toast({
        title: "视频生成失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  // Generate videos for all shots in the scene (async - returns immediately)
  const generateAllVideosMutation = useMutation({
    mutationFn: async ({ sceneId, model }: { sceneId: string; model: VideoModel }) => {
      setIsGeneratingAllVideos(true);
      return apiRequest("POST", `/api/scenes/${sceneId}/generate-all-videos`, { model });
    },
    onSuccess: (data: any) => {
      // Async jobs started - refresh to show "generating" status
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      setIsGeneratingAllVideos(false);
      toast({
        title: "批量视频生成已开始",
        description: `已提交 ${data.total} 个视频生成任务，后台正在处理`,
      });
    },
    onError: () => {
      setIsGeneratingAllVideos(false);
      toast({
        title: "批量视频生成失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const deleteSceneMutation = useMutation({
    mutationFn: async (sceneId: string) => {
      return apiRequest("DELETE", `/api/scenes/${sceneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenes", currentProject?.id] });
      setSelectedScene(null);
      toast({
        title: "删除成功",
        description: "场次已删除",
      });
    },
    onError: () => {
      toast({
        title: "删除失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const extractAllScenesMutation = useMutation({
    mutationFn: async ({ projectId, forceRefresh = false }: { projectId: string; forceRefresh?: boolean }) => {
      return apiRequest("POST", "/api/scenes/extract-all", { projectId, forceRefresh });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenes", currentProject?.id] });
      toast({
        title: "提取成功",
        description: data.message || `已从剧本提取 ${data.created} 个场次`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "提取失败",
        description: error.message || "请确保剧本中包含场次标记",
        variant: "destructive",
      });
    },
  });

  const { data: shotVersions } = useQuery<ShotVersion[]>({
    queryKey: ["/api/shots", editingShotId, "versions"],
    enabled: !!editingShotId,
    queryFn: async () => {
      const response = await fetch(`/api/shots/${editingShotId}/versions`);
      if (!response.ok) throw new Error("Failed to fetch versions");
      return response.json();
    },
  });

  const saveShotVersionMutation = useMutation({
    mutationFn: async (shotId: string) => {
      return apiRequest("POST", `/api/shots/${shotId}/versions`, {
        changeDescription: "手动保存版本",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots", editingShotId, "versions"] });
      toast({
        title: "版本已保存",
        description: "当前分镜版本已保存",
      });
    },
    onError: () => {
      toast({
        title: "保存失败",
        description: "无法保存版本",
        variant: "destructive",
      });
    },
  });

  const restoreShotVersionMutation = useMutation({
    mutationFn: async ({ shotId, versionId }: { shotId: string; versionId: string }) => {
      return apiRequest("POST", `/api/shots/${shotId}/versions/${versionId}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shots", editingShotId, "versions"] });
      setConfirmRestoreShot(false);
      setSelectedShotVersion(null);
      setShowShotVersions(false);
      toast({
        title: "版本已恢复",
        description: "分镜已恢复到选定版本",
      });
    },
    onError: () => {
      toast({
        title: "恢复失败",
        description: "无法恢复版本",
        variant: "destructive",
      });
    },
  });

  const handleCallSheetUpload = async () => {
    if (!currentProject?.id) {
      toast({
        title: "请先选择项目",
        description: "请在左侧项目管理中选择一个项目",
        variant: "destructive",
      });
      return;
    }
    if (!callSheetTitle.trim() || !callSheetText.trim()) {
      toast({
        title: "请填写完整信息",
        description: "通告单标题和内容不能为空",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingCallSheet(true);
    try {
      console.log("Sending call sheet request:", {
        projectId: currentProject.id,
        title: callSheetTitle,
        rawText: callSheetText,
      });

      const response = await apiRequest("POST", "/api/call-sheets/parse-text", {
        projectId: currentProject.id,
        title: callSheetTitle,
        rawText: callSheetText,
      });

      console.log("Call sheet response:", response);

      // Extract scene numbers from response and create scenes if they don't exist
      if (response.sceneNumbers && response.sceneNumbers.length > 0) {
        console.log("Auto-creating or updating scenes from call sheet:", response.sceneNumbers);
        
        // Invalidate queries to refresh the scene list
        await queryClient.invalidateQueries({ queryKey: ["/api/scenes", currentProject.id] });
        await queryClient.invalidateQueries({ queryKey: ["/api/call-sheets", currentProject.id] });
      }

      toast({
        title: "通告单已保存",
        description: "场次信息已自动同步",
      });
      
      setShowCallSheetDialog(false);
      setCallSheetTitle("");
      setCallSheetText("");
    } catch (error) {
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCallSheet(false);
    }
  };

  const handleGenerate = () => {
    if (!selectedScene) {
      toast({
        title: "请选择场次",
        description: "需要选择一个场次来生成分镜",
        variant: "destructive",
      });
      return;
    }

    if (selectedDirectorStyle === "custom" && !customDirectorStyle.trim()) {
      toast({
        title: "请输入自定义导演风格",
        description: "选择自定义风格时需要填写具体的风格描述",
        variant: "destructive",
      });
      return;
    }

    if (selectedVisualStyle === "custom" && !customVisualStyle.trim()) {
      toast({
        title: "请输入自定义画面风格",
        description: "选择自定义风格时需要填写具体的风格描述",
        variant: "destructive",
      });
      return;
    }

    if (selectedAspectRatio === "custom" && !customAspectRatio.trim()) {
      toast({
        title: "请输入自定义画幅比例",
        description: "选择自定义比例时需要填写具体的比例值",
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
    }, 600);

    generateShotsMutation.mutate({
      sceneId: selectedScene.id,
      directorStyle: selectedDirectorStyle,
      customDirectorStyle: selectedDirectorStyle === "custom" ? customDirectorStyle : undefined,
      visualStyle: selectedVisualStyle,
      customVisualStyle: selectedVisualStyle === "custom" ? customVisualStyle : undefined,
      aspectRatio: selectedAspectRatio,
      customAspectRatio: selectedAspectRatio === "custom" ? customAspectRatio : undefined,
    });
  };

  const currentDirector = selectedDirectorStyle !== "custom" ? directorStyleInfo[selectedDirectorStyle as DirectorStyle] : null;

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-72 border-r flex flex-col min-h-0">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">场次列表</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/scenes", currentProject?.id] });
              queryClient.invalidateQueries({ queryKey: ["/api/call-sheets", currentProject?.id] });
              toast({
                title: "已刷新",
                description: "场次列表已更新",
              });
            }}
            data-testid="button-refresh-scenes"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 border-b">
          <Select value={currentProject?.id || ""} onValueChange={(id) => {
            const project = projects?.find((p) => p.id === id);
            if (project) {
              setCurrentProject(project);
              setSelectedScene(null);
            }
          }}>
            <SelectTrigger data-testid="select-project-storyboard">
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
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">选择通告单</label>
              <Select 
                value={selectedCallSheetId || "all"} 
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedCallSheetId(null);
                    // Auto-extract all scenes from script when selecting "全剧本"
                    if (currentProject?.id && (!scenes || scenes.length === 0)) {
                      extractAllScenesMutation.mutate(currentProject.id);
                    }
                  } else {
                    setSelectedCallSheetId(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="显示所有场次" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有场次 (全剧本)</SelectItem>
                  {callSheets?.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.title} ({format(new Date(cs.createdAt), "MM/dd")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {extractAllScenesMutation.isPending && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  正在从剧本提取场次...
                </p>
              )}
            </div>

            <Button 
              variant="default" 
              className="w-full mb-2" 
              onClick={() => {
                if (currentProject?.id) {
                  const hasScenes = scenes && scenes.length > 0;
                  extractAllScenesMutation.mutate({ 
                    projectId: currentProject.id, 
                    forceRefresh: hasScenes 
                  });
                }
              }}
              disabled={!currentProject?.id || extractAllScenesMutation.isPending}
              data-testid="button-extract-all-scenes"
            >
              {extractAllScenesMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {scenes && scenes.length > 0 ? "重新识别场次 (AI)" : "从剧本提取所有场次"}
            </Button>

            <Button 
              variant="outline" 
              className="w-full mb-2 border-dashed" 
              onClick={() => setShowCallSheetDialog(true)}
              data-testid="button-open-callsheet-dialog"
            >
              <Plus className="mr-2 h-4 w-4" />
              添加通告单
            </Button>

            <Button 
              variant="outline" 
              className="w-full mb-4 border-dashed" 
              onClick={() => setShowCreateSceneDialog(true)}
              data-testid="button-open-create-scene-dialog"
            >
              <Plus className="mr-2 h-4 w-4" />
              手动添加场次
            </Button>
            
            {filteredScenes && filteredScenes.length > 0 ? (
              filteredScenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => {
                    setSelectedScene(scene);
                  }}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedScene?.id === scene.id
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  } ${scene.isInCallSheet ? "border-primary ring-1 ring-primary" : ""}`}
                  data-testid={`scene-item-${scene.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {(scene as any).sceneIdentifier || `场次 ${scene.sceneNumber}`}
                    </span>
                    <div className="flex items-center gap-1">
                      {scene.isInCallSheet && (
                        <Badge variant="outline" className="text-[10px]">通告单</Badge>
                      )}
                      {scene.isInCallSheet && !scene.description && !scene.dialogue && !scene.action && (
                        <Badge variant="default" className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-sm transition-all">识别中</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("确定要删除这个场次吗？")) {
                            deleteSceneMutation.mutate(scene.id);
                          }
                        }}
                        data-testid={`button-delete-scene-${scene.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {scene.title}
                  </p>
                  {scene.location && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {scene.location} {scene.timeOfDay && `- ${scene.timeOfDay}`}
                    </p>
                  )}
                  {selectedScene?.id === scene.id && (
                    <div className="mt-3 pt-3 border-t space-y-2 animate-in fade-in slide-in-from-top-1">
                      {scene.description && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">场景描述</p>
                          <p className="text-xs line-clamp-3 mt-0.5">{scene.description}</p>
                        </div>
                      )}
                      {scene.dialogue && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">对白</p>
                          <p className="text-xs line-clamp-3 mt-0.5 italic">{scene.dialogue}</p>
                        </div>
                      )}
                      {scene.action && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">动作描写</p>
                          <p className="text-xs line-clamp-3 mt-0.5">{scene.action}</p>
                        </div>
                      )}
                      {(scene as any).scriptContent && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">原文内容</p>
                          <p className="text-xs line-clamp-4 mt-0.5 whitespace-pre-wrap">{(scene as any).scriptContent}</p>
                        </div>
                      )}
                      {!scene.description && !scene.dialogue && !scene.action && !(scene as any).scriptContent && (
                        <p className="text-[10px] text-muted-foreground italic">暂无剧本详情</p>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-7 text-[10px] mt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSceneDetails(true);
                        }}
                      >
                        查看完整详情
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Film className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-3">
                  {currentProject ? "暂无场次，请先在剧本编辑器中生成剧本" : "请先选择项目"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
          <div className="flex items-center gap-3">
            <Image className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-storyboard-title">智能分镜</h1>
              {selectedScene && (
                <p className="text-sm text-muted-foreground">场次 {selectedScene.sceneNumber}: {selectedScene.title}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" data-testid="button-export-storyboard">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
          </div>
        </div>

        <div className="p-4 border-b bg-muted/30">
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between" data-testid="button-style-settings">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  风格设置
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">导演风格</label>
                  <Select value={selectedDirectorStyle} onValueChange={(v) => setSelectedDirectorStyle(v as DirectorStyle | "custom")}>
                    <SelectTrigger data-testid="select-director-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {directorStyles.map((style) => (
                        <SelectItem key={style} value={style}>
                          {directorStyleInfo[style].nameCN} ({directorStyleInfo[style].name})
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">自定义风格</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedDirectorStyle === "custom" ? (
                    <Input
                      placeholder="描述导演风格，如：长镜头、手持摄影..."
                      value={customDirectorStyle}
                      onChange={(e) => setCustomDirectorStyle(e.target.value)}
                      data-testid="input-custom-director-style"
                    />
                  ) : currentDirector && (
                    <p className="text-xs text-muted-foreground">
                      {currentDirector.traits}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">画面风格</label>
                  <Select value={selectedVisualStyle} onValueChange={(v) => setSelectedVisualStyle(v as VisualStyle | "custom")}>
                    <SelectTrigger data-testid="select-visual-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visualStyles.map((style) => (
                        <SelectItem key={style} value={style}>
                          {visualStyleInfo[style].nameCN}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">自定义风格</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedVisualStyle === "custom" && (
                    <Input
                      placeholder="描述画面风格，如：高对比度、暖色调..."
                      value={customVisualStyle}
                      onChange={(e) => setCustomVisualStyle(e.target.value)}
                      data-testid="input-custom-visual-style"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">画幅比例</label>
                  <Select value={selectedAspectRatio} onValueChange={(v) => setSelectedAspectRatio(v as AspectRatio)}>
                    <SelectTrigger data-testid="select-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aspectRatios.map((ratio) => (
                        <SelectItem key={ratio} value={ratio}>
                          {ratio === "16:9" ? "16:9 (标准宽屏)" :
                           ratio === "2.35:1" ? "2.35:1 (宽银幕)" :
                           ratio === "4:3" ? "4:3 (传统)" :
                           ratio === "1:1" ? "1:1 (方形)" :
                           ratio === "9:16" ? "9:16 (竖屏)" :
                           ratio === "1.85:1" ? "1.85:1 (学院宽银幕)" :
                           "自定义"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAspectRatio === "custom" && (
                    <Input
                      placeholder="例如：2.39:1"
                      value={customAspectRatio}
                      onChange={(e) => setCustomAspectRatio(e.target.value)}
                      data-testid="input-custom-aspect-ratio"
                    />
                  )}
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !selectedScene}
                    className="w-full"
                    data-testid="button-generate-storyboard"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        生成分镜
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {isGenerating && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                      AI正在生成 {currentDirector?.nameCN} 风格分镜...
                    </span>
                    <span>{generationProgress}%</span>
                  </div>
                  <Progress value={generationProgress} />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pb-20">
            {shotsLoading ? (
              <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-video w-full" />
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : shots && shots.length > 0 ? (
              <div className="space-y-4">
                {/* Header with action buttons */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      共 {shots.length} 个镜头
                    </div>
                    <div className="flex items-center border rounded-md overflow-hidden">
                      <Button
                        variant={storyboardViewType === "image" ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-none border-0 h-8"
                        onClick={() => setStoryboardViewType("image")}
                        data-testid="button-view-image"
                      >
                        <Image className="mr-1 h-3 w-3" />
                        图片分镜
                      </Button>
                      <Button
                        variant={storyboardViewType === "text" ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-none border-0 h-8"
                        onClick={() => setStoryboardViewType("text")}
                        data-testid="button-view-text"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        文字分镜
                      </Button>
                      <Button
                        variant={storyboardViewType === "video" ? "secondary" : "ghost"}
                        size="sm"
                        className="rounded-none border-0 h-8"
                        onClick={() => setStoryboardViewType("video")}
                        data-testid="button-view-video"
                      >
                        <Video className="mr-1 h-3 w-3" />
                        视频分镜
                      </Button>
                    </div>
                  </div>
                  {storyboardViewType === "image" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedScene && generateAllImagesMutation.mutate(selectedScene.id)}
                      disabled={isGeneratingAllImages || !selectedScene}
                      data-testid="button-generate-all-images"
                    >
                      {isGeneratingAllImages ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          批量生成中...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="mr-2 h-4 w-4" />
                          一键生成所有图片
                        </>
                      )}
                    </Button>
                  )}
                  {storyboardViewType === "video" && (
                    <div className="flex items-center gap-2">
                      <Select value={selectedVideoModel} onValueChange={(v) => setSelectedVideoModel(v as VideoModel)}>
                        <SelectTrigger className="w-32 h-8" data-testid="select-video-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {videoModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {videoModelInfo[model].nameCN}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectedScene && generateAllVideosMutation.mutate({ sceneId: selectedScene.id, model: selectedVideoModel })}
                        disabled={isGeneratingAllVideos || !selectedScene}
                        data-testid="button-generate-all-videos"
                      >
                        {isGeneratingAllVideos ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            批量生成中...
                          </>
                        ) : (
                          <>
                            <Video className="mr-2 h-4 w-4" />
                            一键生成所有视频
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Shots grid */}
                <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
                {shots.map((shot) => (
                  <Card
                    key={shot.id}
                    className="group hover-elevate cursor-pointer overflow-hidden"
                    onClick={() => {
                      setEditingShotId(shot.id);
                      setShotEdits(shot);
                    }}
                    data-testid={`shot-card-${shot.id}`}
                  >
                    {storyboardViewType === "image" && (
                      <div className="aspect-video bg-muted relative">
                        {shot.imageBase64 ? (
                          <img
                            src={`data:image/png;base64,${shot.imageBase64}`}
                            alt={`Shot ${shot.shotNumber}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Camera className="h-12 w-12 text-muted-foreground/30" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateShotImageMutation.mutate(shot.id);
                              }}
                              disabled={generatingImageId === shot.id}
                              data-testid={`button-generate-image-${shot.id}`}
                            >
                              {generatingImageId === shot.id ? (
                                <>
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                  生成中...
                                </>
                              ) : (
                                <>
                                  <ImagePlus className="mr-2 h-3 w-3" />
                                  生成图片
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="text-xs">
                            #{shot.shotNumber}
                          </Badge>
                        </div>
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button variant="secondary" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            编辑
                          </Button>
                          {!shot.imageBase64 && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateShotImageMutation.mutate(shot.id);
                              }}
                              disabled={generatingImageId === shot.id}
                            >
                              {generatingImageId === shot.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImagePlus className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {storyboardViewType === "video" && (
                      <div className="aspect-video bg-muted relative">
                        {shot.videoUrl ? (
                          <video
                            src={shot.videoUrl}
                            className="w-full h-full object-cover"
                            controls
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : shot.imageBase64 ? (
                          <div className="w-full h-full relative">
                            <img
                              src={`data:image/png;base64,${shot.imageBase64}`}
                              alt={`Shot ${shot.shotNumber}`}
                              className="w-full h-full object-cover opacity-50"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              {shot.videoStatus === "generating" ? (
                                <>
                                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                  <span className="text-sm text-muted-foreground">视频生成中...</span>
                                </>
                              ) : shot.videoStatus === "failed" ? (
                                <>
                                  <span className="text-sm text-destructive">生成失败</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateShotVideoMutation.mutate({ shotId: shot.id, model: selectedVideoModel });
                                    }}
                                    disabled={generatingVideoId === shot.id}
                                    data-testid={`button-retry-video-${shot.id}`}
                                  >
                                    <RefreshCw className="mr-2 h-3 w-3" />
                                    重试
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateShotVideoMutation.mutate({ shotId: shot.id, model: selectedVideoModel });
                                  }}
                                  disabled={generatingVideoId === shot.id}
                                  data-testid={`button-generate-video-${shot.id}`}
                                >
                                  {generatingVideoId === shot.id ? (
                                    <>
                                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                      生成中...
                                    </>
                                  ) : (
                                    <>
                                      <Play className="mr-2 h-3 w-3" />
                                      生成视频
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Camera className="h-12 w-12 text-muted-foreground/30" />
                            <span className="text-sm text-muted-foreground">请先生成图片</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="text-xs">
                            #{shot.shotNumber}
                          </Badge>
                        </div>
                        {shot.videoModel && shot.videoUrl && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="outline" className="text-xs bg-background/80">
                              {videoModelInfo[shot.videoModel]?.nameCN || shot.videoModel}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                    <CardContent className={storyboardViewType === "text" ? "p-4" : "p-4"}>
                      {storyboardViewType === "text" && (
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            #{shot.shotNumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground">镜头</span>
                        </div>
                      )}
                      <p className={storyboardViewType === "text" ? "text-sm" : "text-sm line-clamp-2"}>{shot.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {shot.shotType && (
                          <Badge variant="outline" className="text-xs">
                            {shotTypeInfo[shot.shotType]?.nameCN}
                          </Badge>
                        )}
                        {shot.cameraAngle && (
                          <Badge variant="outline" className="text-xs">
                            {cameraAngleInfo[shot.cameraAngle]?.nameCN}
                          </Badge>
                        )}
                        {shot.cameraMovement && (
                          <Badge variant="outline" className="text-xs">
                            {cameraMovementInfo[shot.cameraMovement]?.nameCN}
                          </Badge>
                        )}
                      </div>
                      {shot.atmosphere && (
                        <p className="text-xs text-muted-foreground mt-2">
                          气氛: {shot.atmosphere}
                        </p>
                      )}
                      {storyboardViewType === "text" && shot.notes && (
                        <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                          备注: {shot.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                </div>
              </div>
            ) : selectedScene ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Image className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">暂无分镜</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                    选择导演风格和画面风格，点击"生成分镜"开始创作
                  </p>
                  <Button className="mt-6" onClick={handleGenerate} data-testid="button-generate-first-storyboard">
                    <Wand2 className="mr-2 h-4 w-4" />
                    生成分镜
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Film className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">请选择场次</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    从左侧选择一个场次来查看或生成分镜
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!editingShotId} onOpenChange={(open) => !open && setEditingShotId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑分镜 #{shotEdits.shotNumber}</DialogTitle>
            <DialogDescription>
              调整镜头参数和画面内容
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-md overflow-hidden">
              {shotEdits.imageBase64 ? (
                <img
                  src={`data:image/png;base64,${shotEdits.imageBase64}`}
                  alt="Shot preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">景别</label>
                <Select 
                  value={shotEdits.shotType || ""} 
                  onValueChange={(v) => setShotEdits(prev => ({ ...prev, shotType: v as ShotType }))}
                >
                  <SelectTrigger data-testid="select-shot-type">
                    <SelectValue placeholder="选择景别" />
                  </SelectTrigger>
                  <SelectContent>
                    {shotTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {shotTypeInfo[type].nameCN}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">角度</label>
                <Select 
                  value={shotEdits.cameraAngle || ""} 
                  onValueChange={(v) => setShotEdits(prev => ({ ...prev, cameraAngle: v as CameraAngle }))}
                >
                  <SelectTrigger data-testid="select-camera-angle">
                    <SelectValue placeholder="选择角度" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameraAngles.map((angle) => (
                      <SelectItem key={angle} value={angle}>
                        {cameraAngleInfo[angle].nameCN}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">运动</label>
                <Select 
                  value={shotEdits.cameraMovement || ""} 
                  onValueChange={(v) => setShotEdits(prev => ({ ...prev, cameraMovement: v as CameraMovement }))}
                >
                  <SelectTrigger data-testid="select-camera-movement">
                    <SelectValue placeholder="选择运动" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameraMovements.map((movement) => (
                      <SelectItem key={movement} value={movement}>
                        {cameraMovementInfo[movement].nameCN}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">镜头描述</label>
              <Textarea
                value={shotEdits.description || ""}
                onChange={(e) => setShotEdits(prev => ({ ...prev, description: e.target.value }))}
                placeholder="描述镜头内容..."
                data-testid="input-shot-description"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">气氛/备注</label>
              <Textarea
                value={shotEdits.atmosphere || ""}
                onChange={(e) => setShotEdits(prev => ({ ...prev, atmosphere: e.target.value }))}
                placeholder="描述画面气氛，或添加备注..."
                data-testid="input-shot-atmosphere"
              />
            </div>

            <Collapsible open={showShotVersions} onOpenChange={setShowShotVersions}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <History className="mr-2 h-4 w-4" />
                  版本历史
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${showShotVersions ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => editingShotId && saveShotVersionMutation.mutate(editingShotId)}
                    disabled={saveShotVersionMutation.isPending}
                    data-testid="button-save-shot-version"
                  >
                    {saveShotVersionMutation.isPending ? (
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-3 w-3" />
                    )}
                    保存当前版本
                  </Button>
                  
                  {shotVersions && shotVersions.length > 0 ? (
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {shotVersions.map((version) => (
                          <div
                            key={version.id}
                            className="p-2 border rounded-md hover-elevate cursor-pointer text-sm"
                            onClick={() => {
                              setSelectedShotVersion(version);
                              setConfirmRestoreShot(true);
                            }}
                            data-testid={`shot-version-${version.id}`}
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
                    <p className="text-xs text-muted-foreground text-center py-2">
                      暂无版本历史
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShotId(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (editingShotId) {
                  updateShotMutation.mutate({
                    id: editingShotId,
                    updates: shotEdits,
                  });
                }
              }}
              disabled={updateShotMutation.isPending}
              data-testid="button-save-shot"
            >
              {updateShotMutation.isPending ? "保存中..." : "保存更改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateSceneDialog} onOpenChange={(open) => {
        setShowCreateSceneDialog(open);
        if (!open) {
          setScenePreview(null);
          setNewSceneNumber("");
          setNewSceneTitle("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>手动添加场次</DialogTitle>
            <DialogDescription>
              输入场次号后系统将自动从剧本中提取相关内容（如有）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">场次号</label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  placeholder="例如: 1" 
                  value={newSceneNumber}
                  onChange={(e) => setNewSceneNumber(e.target.value)}
                  data-testid="input-scene-number"
                />
                <Button 
                  variant="outline" 
                  disabled={!newSceneNumber || !currentProject?.id || isLoadingPreview}
                  onClick={async () => {
                    if (!currentProject?.id || !newSceneNumber) return;
                    setIsLoadingPreview(true);
                    try {
                      const result = await apiRequest("POST", "/api/scenes/preview", {
                        projectId: currentProject.id,
                        sceneNumber: parseInt(newSceneNumber),
                      });
                      setScenePreview(result);
                      if (result.found && result.title) {
                        setNewSceneTitle(result.title);
                      }
                    } catch (error) {
                      toast({ title: "预览失败", description: "请稍后重试", variant: "destructive" });
                    } finally {
                      setIsLoadingPreview(false);
                    }
                  }}
                  data-testid="button-preview-script"
                >
                  {isLoadingPreview ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  预览剧本
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">场次标题</label>
              <Input 
                placeholder="例如: 医院走廊 / Hospital Corridor (支持中英文)"
                value={newSceneTitle}
                onChange={(e) => setNewSceneTitle(e.target.value)}
                data-testid="input-scene-title"
              />
            </div>
            
            {scenePreview && (
              <div className="border rounded-md p-4 bg-muted/30 space-y-3">
                <div className="flex items-center gap-2">
                  {scenePreview.found ? (
                    <Badge variant="default" className="bg-green-500">已找到</Badge>
                  ) : (
                    <Badge variant="secondary">未找到</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">{scenePreview.message}</span>
                </div>
                
                {scenePreview.found && (
                  <div className="grid gap-3 text-sm">
                    {(scenePreview.location || scenePreview.timeOfDay) && (
                      <div className="flex gap-4">
                        {scenePreview.location && (
                          <div>
                            <span className="text-muted-foreground">地点：</span>
                            <span className="font-medium">{scenePreview.location}</span>
                          </div>
                        )}
                        {scenePreview.timeOfDay && (
                          <div>
                            <span className="text-muted-foreground">时间：</span>
                            <span className="font-medium">{scenePreview.timeOfDay}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {scenePreview.description && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">场景描述</p>
                        <p className="text-sm line-clamp-3 bg-background p-2 rounded">{scenePreview.description}</p>
                      </div>
                    )}
                    {scenePreview.dialogue && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">对白</p>
                        <p className="text-sm line-clamp-3 bg-background p-2 rounded italic">{scenePreview.dialogue}</p>
                      </div>
                    )}
                    {scenePreview.action && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">动作</p>
                        <p className="text-sm line-clamp-3 bg-background p-2 rounded">{scenePreview.action}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSceneDialog(false)}>取消</Button>
            <Button 
              disabled={isCreatingScene || !newSceneNumber || !newSceneTitle || !currentProject?.id}
              onClick={async () => {
                if (!currentProject?.id) return;
                setIsCreatingScene(true);
                try {
                  const scene = await apiRequest("POST", "/api/scenes", {
                    projectId: currentProject.id,
                    sceneNumber: parseInt(newSceneNumber),
                    title: newSceneTitle,
                    isInCallSheet: true
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/scenes", currentProject.id] });
                  setSelectedScene(scene);
                  setShowCreateSceneDialog(false);
                  setNewSceneNumber("");
                  setNewSceneTitle("");
                  setScenePreview(null);
                  toast({ title: "场次添加成功", description: scenePreview?.found ? "已自动关联剧本内容" : "现在可以为该场次生成分镜了" });
                } catch (error) {
                  toast({ title: "添加失败", description: "请稍后重试", variant: "destructive" });
                } finally {
                  setIsCreatingScene(false);
                }
              }}
              data-testid="button-confirm-create-scene"
            >
              {isCreatingScene ? "创建中..." : "确定添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCallSheetDialog} onOpenChange={setShowCallSheetDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加通告单</DialogTitle>
            <DialogDescription>
              输入通告单信息，系统将自动识别场次并匹配剧本。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">标题</label>
              <Input 
                placeholder="例如：2024-01-11 拍摄通告" 
                value={callSheetTitle}
                onChange={(e) => setCallSheetTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">内容</label>
              <Textarea 
                placeholder="在此粘贴通告单文本，系统将识别类似'场次: 1, 3, 5'的信息..."
                className="min-h-[200px]"
                value={callSheetText}
                onChange={(e) => {
                  console.log("Textarea changed:", e.target.value);
                  setCallSheetText(e.target.value);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallSheetDialog(false)}>取消</Button>
            <Button onClick={handleCallSheetUpload} disabled={isUploadingCallSheet}>
              {isUploadingCallSheet ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              识别并保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSceneDetails} onOpenChange={setShowSceneDetails}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>场次详情: {selectedScene?.sceneNumber}</DialogTitle>
            <DialogDescription>{selectedScene?.title}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-2">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">地点</p>
                  <p className="text-sm font-medium">{selectedScene?.location || "未指定"}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">时间</p>
                  <p className="text-sm font-medium">{selectedScene?.timeOfDay || "未指定"}</p>
                </div>
              </div>
              
              {selectedScene?.scriptContent && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    完整剧本原文
                  </h3>
                  <div className="p-4 border rounded-md bg-muted/30 max-h-64 overflow-y-auto">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">{selectedScene.scriptContent}</p>
                  </div>
                </div>
              )}

              {selectedScene?.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    场景描述
                  </h3>
                  <div className="p-4 border rounded-md bg-background">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedScene.description}</p>
                  </div>
                </div>
              )}

              {selectedScene?.action && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    动作
                  </h3>
                  <div className="p-4 border rounded-md bg-background">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedScene.action}</p>
                  </div>
                </div>
              )}

              {selectedScene?.dialogue && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    对白
                  </h3>
                  <div className="p-4 border rounded-md bg-background italic">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedScene.dialogue}</p>
                  </div>
                </div>
              )}

              {!selectedScene?.scriptContent && !selectedScene?.description && !selectedScene?.dialogue && !selectedScene?.action && (
                <div className="p-4 border rounded-md bg-muted/30 text-center text-muted-foreground">
                  <p className="text-sm">暂无剧本内容，请在剧本页面上传或编辑剧本后重新同步场次信息。</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4 flex-shrink-0">
            <Button onClick={() => setShowSceneDetails(false)}>关闭</Button>
            <Button variant="outline" onClick={() => {
              setShowSceneDetails(false);
              handleGenerate();
            }}>
              <Wand2 className="mr-2 h-4 w-4" />
              基于此生成分镜
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRestoreShot} onOpenChange={setConfirmRestoreShot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复版本</DialogTitle>
            <DialogDescription>
              您确定要将分镜恢复到版本 v{selectedShotVersion?.version} 吗？当前版本将自动保存到历史记录中。
            </DialogDescription>
          </DialogHeader>
          {selectedShotVersion && (
            <div className="border rounded-md p-3 bg-muted/50">
              <p className="text-sm whitespace-pre-wrap line-clamp-4">
                {selectedShotVersion.description}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestoreShot(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (selectedShotVersion && editingShotId) {
                  restoreShotVersionMutation.mutate({
                    shotId: editingShotId,
                    versionId: selectedShotVersion.id,
                  });
                }
              }}
              disabled={restoreShotVersionMutation.isPending}
              data-testid="button-confirm-restore-shot"
            >
              {restoreShotVersionMutation.isPending ? (
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
