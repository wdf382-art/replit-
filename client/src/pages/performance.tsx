import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Drama,
  Wand2,
  RefreshCw,
  Heart,
  Lightbulb,
  AlertTriangle,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  Users,
  User,
  MessageSquare,
  FileText,
  TrendingUp,
  ArrowRight,
  Shirt,
  Package,
  BookOpen,
  Brain,
  BarChart3,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { 
  Project, 
  Scene, 
  Character, 
  ScriptAnalysisGlobal, 
  PerformanceGuideV2,
  SceneHookData,
  SceneDiagnosisData,
  EmotionalChainData,
  CharacterPerformanceData,
} from "@shared/schema";

export default function PerformancePage() {
  const { toast } = useToast();
  const { currentProject, setCurrentProject } = useAppStore();

  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isGeneratingGlobal, setIsGeneratingGlobal] = useState(false);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: scenes } = useQuery<Scene[]>({
    queryKey: ["/api/scenes", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ["/api/characters", currentProject?.id],
    enabled: !!currentProject?.id,
  });

  const { data: globalAnalysis, isLoading: globalLoading } = useQuery<ScriptAnalysisGlobal | null>({
    queryKey: ["/api/script-analysis-global", currentProject?.id],
    queryFn: async () => {
      if (!currentProject?.id) return null;
      const res = await fetch(`/api/script-analysis-global/${currentProject.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentProject?.id,
  });

  const { data: sceneGuide, isLoading: guideLoading } = useQuery<PerformanceGuideV2 | null>({
    queryKey: ["/api/performance-guides-v2", selectedScene?.id],
    queryFn: async () => {
      if (!selectedScene?.id) return null;
      const res = await fetch(`/api/performance-guides-v2/${selectedScene.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedScene?.id,
  });

  useEffect(() => {
    if (scenes && scenes.length > 0 && !selectedScene) {
      const sortedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
      setSelectedScene(sortedScenes[0]);
    }
  }, [scenes, selectedScene]);

  const generateGlobalMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest("POST", "/api/script-analysis-global/generate", { projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/script-analysis-global"] });
      setIsGeneratingGlobal(false);
      setGenerationProgress(100);
      toast({
        title: "全剧分析完成",
        description: "AI已完成全剧人物弧光和情绪分析",
      });
    },
    onError: (error: Error) => {
      setIsGeneratingGlobal(false);
      toast({
        title: "分析失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const generateSceneMutation = useMutation({
    mutationFn: async (sceneId: string) => {
      return apiRequest("POST", "/api/performance-guides-v2/generate", { sceneId });
    },
    onSuccess: (_data, sceneId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-guides-v2", sceneId] });
      setIsGeneratingScene(false);
      setGenerationProgress(100);
      toast({
        title: "场次表演指导完成",
        description: "AI已生成详细的表演指导",
      });
    },
    onError: (error: Error) => {
      setIsGeneratingScene(false);
      toast({
        title: "生成失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleGenerateGlobal = () => {
    if (!currentProject) return;
    setIsGeneratingGlobal(true);
    setGenerationProgress(0);
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 5;
      });
    }, 800);
    generateGlobalMutation.mutate(currentProject.id);
  };

  const handleGenerateScene = () => {
    if (!selectedScene) return;
    setIsGeneratingScene(true);
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
    generateSceneMutation.mutate(selectedScene.id);
  };

  const sortedScenes = scenes ? [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber) : [];

  const hook = sceneGuide?.sceneHook as SceneHookData | null;
  const diagnosis = sceneGuide?.sceneDiagnosis as SceneDiagnosisData | null;
  const chain = sceneGuide?.emotionalChain as EmotionalChainData | null;
  const performances = (sceneGuide?.characterPerformances || []) as CharacterPerformanceData[];

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-72 border-r overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">场次导航</h2>
          <p className="text-xs text-muted-foreground mt-1">选择场次查看表演指导</p>
        </div>

        <div className="p-4 border-b space-y-3">
          <Select value={currentProject?.id || ""} onValueChange={(id) => {
            const project = projects?.find((p) => p.id === id);
            if (project) {
              setCurrentProject(project);
              setSelectedScene(null);
            }
          }}>
            <SelectTrigger data-testid="select-project-performance">
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
          <div className="p-2 space-y-1">
            {sortedScenes.length > 0 ? (
              sortedScenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => setSelectedScene(scene)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedScene?.id === scene.id
                      ? "bg-primary/10 border border-primary"
                      : "hover-elevate"
                  }`}
                  data-testid={`scene-nav-${scene.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">第{scene.sceneIdentifier || scene.sceneNumber}场</span>
                    {scene.id === selectedScene?.id && <ChevronRight className="h-4 w-4" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {scene.title || scene.location || "未命名"}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Drama className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-3">
                  {currentProject ? "暂无场次" : "请先选择项目"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-4 border-b">
          <div className="flex items-center gap-3">
            <Drama className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-performance-title">表演指导</h1>
              {selectedScene && (
                <p className="text-sm text-muted-foreground">
                  第{selectedScene.sceneIdentifier || selectedScene.sceneNumber}场 - {selectedScene.title || selectedScene.location || "未命名"}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateGlobal}
              disabled={isGeneratingGlobal || !currentProject}
              data-testid="button-generate-global"
            >
              {isGeneratingGlobal ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  全剧分析
                </>
              )}
            </Button>

            <Button
              onClick={handleGenerateScene}
              disabled={isGeneratingScene || !selectedScene}
              data-testid="button-generate-performance"
            >
              {isGeneratingScene ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  生成本场指导
                </>
              )}
            </Button>
          </div>
        </div>

        {(isGeneratingGlobal || isGeneratingScene) && (
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                {isGeneratingGlobal ? "AI正在通读全剧分析人物弧光..." : "AI正在生成场次表演指导..."}
              </span>
              <span>{generationProgress}%</span>
            </div>
            <Progress value={generationProgress} />
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {globalAnalysis && (
              <Collapsible defaultOpen={false}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          全剧分析概览
                        </CardTitle>
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <CardDescription>
                        {globalAnalysis.overallTheme || "点击展开查看全剧人物弧光与情绪地图"}
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {(globalAnalysis.characterArcs as any[])?.map((arc, i) => (
                        <div key={i} className="p-3 border rounded-md">
                          <div className="font-medium">{arc.characterName}</div>
                          <p className="text-sm text-muted-foreground mt-1">{arc.arcDescription}</p>
                          <div className="flex gap-4 mt-2 text-xs">
                            <span>起点: {arc.startState}</span>
                            <ArrowRight className="h-4 w-4" />
                            <span>终点: {arc.endState}</span>
                          </div>
                        </div>
                      ))}
                      {globalAnalysis.keyScenes && (globalAnalysis.keyScenes as number[]).length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">关键场次:</span>
                          {(globalAnalysis.keyScenes as number[]).map((num) => (
                            <Badge key={num} variant="secondary">第{num}场</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {selectedScene && (selectedScene.dialogue || selectedScene.action) && (
              <Collapsible defaultOpen>
                <Card data-testid="card-scene-content">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <CardTitle>场次原文</CardTitle>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {selectedScene.dialogue && (
                        <div>
                          <div className="text-sm font-medium mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            对白
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md max-h-48 overflow-y-auto">
                            {selectedScene.dialogue}
                          </div>
                        </div>
                      )}
                      {selectedScene.action && (
                        <div>
                          <div className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            动作描写
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md max-h-48 overflow-y-auto">
                            {selectedScene.action}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {guideLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : sceneGuide ? (
              <>
                {hook && (
                  <Card data-testid="card-scene-hook">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        戏点分析
                      </CardTitle>
                      <CardDescription>本场的核心戏剧点及情绪曲线</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                        <div className="text-sm font-medium mb-2">{hook.hookDescription}</div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{hook.hookType || "类型未知"}</Badge>
                          <Badge variant="outline">{hook.hookPosition || "位置未知"}</Badge>
                        </div>
                        {hook.hookTrigger && (
                          <p className="text-xs text-muted-foreground mt-2">触发点: {hook.hookTrigger}</p>
                        )}
                      </div>

                      {hook.emotionCurve && (
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "开场", value: hook.emotionCurve.opening },
                            { label: "铺垫", value: hook.emotionCurve.buildup },
                            { label: "高潮", value: hook.emotionCurve.climax },
                            { label: "结尾", value: hook.emotionCurve.ending },
                          ].map((item) => (
                            <div key={item.label} className="text-center">
                              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                              <div className="h-16 bg-muted rounded-md relative overflow-hidden">
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-primary/50"
                                  style={{ height: `${item.value}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                  {item.value}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {hook.beforeAfterContrast && (
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="p-3 border rounded-md">
                            <div className="text-xs text-muted-foreground mb-1">场前状态</div>
                            <div className="text-sm">{hook.beforeAfterContrast.before}</div>
                          </div>
                          <div className="p-3 border rounded-md bg-primary/5 border-primary/20">
                            <div className="text-xs text-muted-foreground mb-1">场中状态</div>
                            <div className="text-sm">{hook.beforeAfterContrast.during}</div>
                          </div>
                          <div className="p-3 border rounded-md">
                            <div className="text-xs text-muted-foreground mb-1">场后状态</div>
                            <div className="text-sm">{hook.beforeAfterContrast.after}</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {diagnosis && diagnosis.isFlatScene && (
                  <Card data-testid="card-scene-diagnosis" className="border-amber-500/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        场次诊断 - 存在"平"的风险
                      </CardTitle>
                      <CardDescription>以下是可能导致场次平淡的原因及破解方案</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {diagnosis.flatReasons && diagnosis.flatReasons.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">问题诊断</h4>
                          <ul className="space-y-1">
                            {diagnosis.flatReasons.map((reason, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">-</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {diagnosis.solutions && diagnosis.solutions.length > 0 && (
                        <Accordion type="single" collapsible>
                          {diagnosis.solutions.map((solution, i) => (
                            <AccordionItem key={i} value={`solution-${i}`}>
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-primary" />
                                  <span className="font-medium">方案{i + 1}: {solution.title}</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2 pt-2">
                                  <p className="text-sm text-muted-foreground">{solution.description}</p>
                                  {solution.implementationSteps && solution.implementationSteps.length > 0 && (
                                    <ul className="space-y-1 ml-4">
                                      {solution.implementationSteps.map((step, j) => (
                                        <li key={j} className="text-sm list-disc">{step}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                )}

                {chain && (
                  <Card data-testid="card-emotional-chain">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5 text-primary" />
                        情绪承接链
                      </CardTitle>
                      <CardDescription>场次间的情绪衔接与过渡</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 overflow-x-auto pb-2">
                        {chain.previousScene && (
                          <>
                            <div className="flex-shrink-0 p-3 border rounded-md min-w-[150px]">
                              <div className="text-xs text-muted-foreground">上一场 (第{chain.previousScene.sceneNumber}场)</div>
                              <div className="text-sm font-medium mt-1">{chain.previousScene.emotionalEndpoint}</div>
                              <div className="text-xs text-muted-foreground mt-1">{chain.previousScene.keyEvent}</div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </>
                        )}

                        <div className="flex-shrink-0 p-3 border-2 border-primary rounded-md bg-primary/5 min-w-[180px]">
                          <div className="text-xs text-primary font-medium">本场</div>
                          <div className="text-sm mt-1">
                            <span className="text-muted-foreground">起点:</span> {chain.currentScene.emotionalStartpoint}
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">终点:</span> {chain.currentScene.emotionalEndpoint}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">目标: {chain.currentScene.sceneObjective}</div>
                        </div>

                        {chain.nextScene && (
                          <>
                            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-shrink-0 p-3 border rounded-md min-w-[150px]">
                              <div className="text-xs text-muted-foreground">下一场 (第{chain.nextScene.sceneNumber}场)</div>
                              <div className="text-sm font-medium mt-1">{chain.nextScene.emotionalStartpoint}</div>
                              <div className="text-xs text-muted-foreground mt-1">{chain.nextScene.transitionNote}</div>
                            </div>
                          </>
                        )}
                      </div>

                      {chain.directorTip && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-md">
                          <div className="flex items-center gap-2 text-sm font-medium mb-1">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            导演开拍提示
                          </div>
                          <p className="text-sm text-muted-foreground">{chain.directorTip}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {performances.length > 0 && (
                  <Card data-testid="card-character-performances">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        角色表演指导
                      </CardTitle>
                      <CardDescription>点击角色查看详细的导演讲戏稿</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {performances.map((perf, index) => (
                          <Collapsible
                            key={index}
                            open={expandedCharacter === perf.characterName}
                            onOpenChange={(open) => setExpandedCharacter(open ? perf.characterName : null)}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="p-4 border rounded-md cursor-pointer hover-elevate">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                      <User className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <div className="font-medium">{perf.characterName}</div>
                                      {perf.positioning && (
                                        <div className="text-xs text-muted-foreground">
                                          {perf.positioning.currentAppearance} | {perf.positioning.currentPhase}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedCharacter === perf.characterName ? "rotate-180" : ""}`} />
                                </div>

                                {perf.performanceLayers && (
                                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                    <div className="p-2 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">表层:</span> {perf.performanceLayers.surface}
                                    </div>
                                    <div className="p-2 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">中层:</span> {perf.performanceLayers.middle}
                                    </div>
                                    <div className="p-2 bg-muted/50 rounded">
                                      <span className="text-muted-foreground">核心:</span> {perf.performanceLayers.core}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="mt-2 p-4 border border-t-0 rounded-b-md space-y-4">
                                {perf.directorScript && perf.directorScript.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                      <MessageSquare className="h-4 w-4 text-primary" />
                                      导演讲戏稿
                                    </h4>
                                    <div className="space-y-3">
                                      {perf.directorScript.map((script, i) => (
                                        <div key={i} className="p-4 bg-muted/30 rounded-md">
                                          <div className="text-xs text-primary font-medium mb-2">{script.segment}</div>
                                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{script.content}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {perf.actionDesign && perf.actionDesign.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                      <TrendingUp className="h-4 w-4 text-primary" />
                                      动作设计
                                    </h4>
                                    <div className="space-y-2">
                                      {perf.actionDesign.map((action, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm">
                                          <Badge variant="outline" className="shrink-0">{action.timing}</Badge>
                                          <div>
                                            <div>{action.action}</div>
                                            <div className="text-xs text-muted-foreground">{action.meaning}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {perf.subtext && perf.subtext.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                      <BookOpen className="h-4 w-4 text-primary" />
                                      潜台词对照
                                    </h4>
                                    <div className="space-y-2">
                                      {perf.subtext.map((sub, i) => (
                                        <div key={i} className="grid grid-cols-2 gap-2 text-sm">
                                          <div className="p-2 bg-muted/30 rounded">"{sub.originalLine}"</div>
                                          <div className="p-2 bg-primary/5 rounded italic">{sub.realMeaning}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {perf.interactionNotes && perf.interactionNotes.length > 0 && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                      <Users className="h-4 w-4 text-primary" />
                                      对手戏处理
                                    </h4>
                                    <div className="space-y-2">
                                      {perf.interactionNotes.map((note, i) => (
                                        <div key={i} className="p-2 bg-muted/30 rounded text-sm">
                                          <div className="font-medium mb-1">与 {note.withCharacter}</div>
                                          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                                            <div>眼神: {note.eyeContact}</div>
                                            <div>距离: {note.physicalDistance}</div>
                                            <div>身体接触: {note.bodyContact}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {sceneGuide?.propPerformance && (sceneGuide.propPerformance as any[]).length > 0 && (
                  <Card data-testid="card-prop-performance">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        道具表演关联
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(sceneGuide.propPerformance as any[]).map((prop, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 border rounded-md text-sm">
                            <Badge variant="secondary">{prop.prop}</Badge>
                            <div>
                              <div>{prop.usage}</div>
                              <div className="text-xs text-muted-foreground">{prop.emotionalMeaning}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {sceneGuide?.costumeProgression && (sceneGuide.costumeProgression as any[]).length > 0 && (
                  <Card data-testid="card-costume-progression">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shirt className="h-5 w-5 text-primary" />
                        服装状态变化
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(sceneGuide.costumeProgression as any[]).map((costume, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 border rounded-md text-sm">
                            <Badge variant="outline">{costume.timing}</Badge>
                            <div>
                              <div>{costume.state}</div>
                              <div className="text-xs text-muted-foreground">{costume.meaning}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : selectedScene ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Drama className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">暂无表演指导</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                    点击"生成本场指导"，AI将通读全剧后为本场设计详细的表演方案
                  </p>
                  <Button className="mt-6" onClick={handleGenerateScene} data-testid="button-generate-first-performance">
                    <Wand2 className="mr-2 h-4 w-4" />
                    生成本场表演指导
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FileText className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">请选择场次</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    从左侧选择场次来查看表演指导
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
