import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Drama,
  User,
  Wand2,
  RefreshCw,
  ChevronRight,
  Heart,
  Lightbulb,
  MessageSquare,
  Activity,
  Sparkles,
  Check,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { Project, Scene, Character, PerformanceGuide } from "@shared/schema";

interface PerformanceOption {
  option: string;
  description: string;
  actions: string[];
}

export default function PerformancePage() {
  const { toast } = useToast();
  const { currentProject, setCurrentProject } = useAppStore();

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("guide");

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

  const { data: performanceGuides, isLoading: guidesLoading } = useQuery<PerformanceGuide[]>({
    queryKey: ["/api/performance-guides", selectedScene?.id, selectedCharacter?.id],
    enabled: !!selectedScene?.id && !!selectedCharacter?.id,
  });

  useEffect(() => {
    if (characters && characters.length > 0 && !selectedCharacter) {
      setSelectedCharacter(characters[0]);
    }
  }, [characters, selectedCharacter]);

  useEffect(() => {
    if (scenes && scenes.length > 0 && !selectedScene) {
      setSelectedScene(scenes[0]);
    }
  }, [scenes, selectedScene]);

  const generateGuideMutation = useMutation({
    mutationFn: async (data: { sceneId: string; characterId: string }) => {
      return apiRequest("POST", "/api/performance-guides/generate", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-guides"] });
      setIsGenerating(false);
      setGenerationProgress(100);
      toast({
        title: "表演指导生成完成",
        description: "AI已为您生成专业表演指导",
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

  const handleGenerate = () => {
    if (!selectedScene || !selectedCharacter) {
      toast({
        title: "请选择角色和场次",
        description: "需要选择角色和场次来生成表演指导",
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

    generateGuideMutation.mutate({
      sceneId: selectedScene.id,
      characterId: selectedCharacter.id,
    });
  };

  const currentGuide = performanceGuides?.[0];

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-72 border-r overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">角色选择</h2>
          <p className="text-xs text-muted-foreground mt-1">选择要查看表演指导的角色</p>
        </div>

        <div className="p-4 border-b space-y-3">
          <Select value={currentProject?.id || ""} onValueChange={(id) => {
            const project = projects?.find((p) => p.id === id);
            if (project) {
              setCurrentProject(project);
              setSelectedCharacter(null);
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

          <Select value={selectedScene?.id || ""} onValueChange={(id) => {
            const scene = scenes?.find((s) => s.id === id);
            if (scene) setSelectedScene(scene);
          }}>
            <SelectTrigger data-testid="select-scene-performance">
              <SelectValue placeholder="选择场次" />
            </SelectTrigger>
            <SelectContent>
              {scenes?.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  场次 {scene.sceneNumber}: {scene.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {characters && characters.length > 0 ? (
              characters.map((character) => (
                <div
                  key={character.id}
                  onClick={() => setSelectedCharacter(character)}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedCharacter?.id === character.id
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  }`}
                  data-testid={`character-item-${character.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <span className="font-medium">{character.name}</span>
                      {character.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {character.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <User className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-3">
                  {currentProject ? "暂无角色，请先在剧本中定义角色" : "请先选择项目"}
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
              {selectedCharacter && selectedScene && (
                <p className="text-sm text-muted-foreground">
                  {selectedCharacter.name} - 场次 {selectedScene.sceneNumber}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedScene || !selectedCharacter}
            data-testid="button-generate-performance"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                生成表演指导
              </>
            )}
          </Button>
        </div>

        {isGenerating && (
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                AI正在分析角色情绪线和生成表演方案...
              </span>
              <span>{generationProgress}%</span>
            </div>
            <Progress value={generationProgress} />
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4">
            {guidesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : currentGuide ? (
              <div className="space-y-6 max-w-4xl">
                <Card data-testid="card-emotion-arc">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-primary" />
                      情绪变化
                    </CardTitle>
                    <CardDescription>
                      该场次中角色的情绪发展线
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="p-4 border rounded-md">
                        <div className="text-xs text-muted-foreground mb-1">场次之前</div>
                        <div className="font-medium">{currentGuide.emotionBefore || "—"}</div>
                      </div>
                      <div className="p-4 border rounded-md bg-primary/5 border-primary">
                        <div className="text-xs text-muted-foreground mb-1">场次中</div>
                        <div className="font-medium">{currentGuide.emotionDuring || "—"}</div>
                      </div>
                      <div className="p-4 border rounded-md">
                        <div className="text-xs text-muted-foreground mb-1">场次之后</div>
                        <div className="font-medium">{currentGuide.emotionAfter || "—"}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-director-notes">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      导演指导
                    </CardTitle>
                    <CardDescription>
                      专业导演级别的详细表演指导
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {currentGuide.directorNotes || "暂无导演指导"}
                    </p>
                  </CardContent>
                </Card>

                {currentGuide.performanceOptions && (currentGuide.performanceOptions as PerformanceOption[]).length > 0 && (
                  <Card data-testid="card-performance-options">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        表演方案选择
                      </CardTitle>
                      <CardDescription>
                        多种表演方案供导演和演员选择
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {(currentGuide.performanceOptions as PerformanceOption[]).map((option, index) => (
                          <AccordionItem key={index} value={`option-${index}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary">方案 {String.fromCharCode(65 + index)}</Badge>
                                <span className="font-medium">{option.option}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-4 pt-2">
                                <p className="text-sm text-muted-foreground">{option.description}</p>
                                {option.actions && option.actions.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-medium mb-2">具体动作</h4>
                                    <ul className="space-y-2">
                                      {option.actions.map((action, actionIndex) => (
                                        <li key={actionIndex} className="flex items-start gap-2 text-sm">
                                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                          <span>{action}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                )}

                {(currentGuide.dialogueSuggestions || currentGuide.actionSuggestions) && (
                  <Card data-testid="card-suggestions">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        台词与动作建议
                      </CardTitle>
                      <CardDescription>
                        对剧本中台词和动作的优化建议
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {currentGuide.dialogueSuggestions && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">台词修改建议</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {currentGuide.dialogueSuggestions}
                          </p>
                        </div>
                      )}
                      {currentGuide.actionSuggestions && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">动作设计建议</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {currentGuide.actionSuggestions}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : selectedScene && selectedCharacter ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Drama className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">暂无表演指导</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                    点击"生成表演指导"，AI将为您分析角色情绪并提供专业表演方案
                  </p>
                  <Button className="mt-6" onClick={handleGenerate} data-testid="button-generate-first-performance">
                    <Wand2 className="mr-2 h-4 w-4" />
                    生成表演指导
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <User className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">请选择角色和场次</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    从左侧选择角色，并选择对应场次来查看表演指导
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
