import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shirt,
  Wand2,
  RefreshCw,
  User,
  Palette,
  Package,
  Link2,
  AlertCircle,
  CheckCircle,
  Sparkles,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppStore } from "@/lib/store";
import type { Project, Scene, Character, ProductionNotes } from "@shared/schema";

export default function ProductionPage() {
  const { toast } = useToast();
  const { currentProject, setCurrentProject } = useAppStore();

  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

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

  const { data: productionNotes, isLoading: notesLoading } = useQuery<ProductionNotes[]>({
    queryKey: ["/api/production-notes", selectedScene?.id],
    enabled: !!selectedScene?.id,
  });

  useEffect(() => {
    if (scenes && scenes.length > 0 && !selectedScene) {
      setSelectedScene(scenes[0]);
    }
  }, [scenes, selectedScene]);

  const generateNotesMutation = useMutation({
    mutationFn: async (data: { sceneId: string }) => {
      return apiRequest("POST", "/api/production-notes/generate", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-notes"] });
      setIsGenerating(false);
      setGenerationProgress(100);
      toast({
        title: "服化道提示生成完成",
        description: "AI已为您生成详细的服化道提示",
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
    if (!selectedScene) {
      toast({
        title: "请选择场次",
        description: "需要选择一个场次来生成服化道提示",
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

    generateNotesMutation.mutate({
      sceneId: selectedScene.id,
    });
  };

  const getCharacterName = (characterId: string | null) => {
    if (!characterId) return "通用";
    const character = characters?.find((c) => c.id === characterId);
    return character?.name || "未知角色";
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-72 border-r overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">场次列表</h2>
          <p className="text-xs text-muted-foreground mt-1">选择要查看服化道提示的场次</p>
        </div>

        <div className="p-4 border-b">
          <Select value={currentProject?.id || ""} onValueChange={(id) => {
            const project = projects?.find((p) => p.id === id);
            if (project) {
              setCurrentProject(project);
              setSelectedScene(null);
            }
          }}>
            <SelectTrigger data-testid="select-project-production">
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
          <div className="p-4 space-y-2">
            {scenes && scenes.length > 0 ? (
              scenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => setSelectedScene(scene)}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedScene?.id === scene.id
                      ? "border-primary bg-primary/5"
                      : "hover-elevate"
                  }`}
                  data-testid={`scene-production-${scene.id}`}
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
              ))
            ) : (
              <div className="text-center py-8">
                <Shirt className="h-10 w-10 mx-auto text-muted-foreground/30" />
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
            <Shirt className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-production-title">服化道提示</h1>
              {selectedScene && (
                <p className="text-sm text-muted-foreground">场次 {selectedScene.sceneNumber}: {selectedScene.title}</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedScene}
            data-testid="button-generate-production"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                生成服化道提示
              </>
            )}
          </Button>
        </div>

        {isGenerating && (
          <div className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                AI正在分析场次需求并生成服化道提示...
              </span>
              <span>{generationProgress}%</span>
            </div>
            <Progress value={generationProgress} />
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4">
            {notesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : productionNotes && productionNotes.length > 0 ? (
              <div className="space-y-4">
                {productionNotes.map((note) => (
                  <Card key={note.id} data-testid={`production-note-${note.id}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <User className="h-4 w-4" />
                        {getCharacterName(note.characterId)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="costume" className="w-full">
                        <TabsList className="w-full justify-start">
                          <TabsTrigger value="costume">
                            <Shirt className="mr-2 h-4 w-4" />
                            服装
                          </TabsTrigger>
                          <TabsTrigger value="makeup">
                            <Palette className="mr-2 h-4 w-4" />
                            化妆
                          </TabsTrigger>
                          <TabsTrigger value="props">
                            <Package className="mr-2 h-4 w-4" />
                            道具
                          </TabsTrigger>
                          <TabsTrigger value="continuity">
                            <Link2 className="mr-2 h-4 w-4" />
                            接戏
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="costume" className="mt-4">
                          {note.costumeNotes ? (
                            <p className="text-sm whitespace-pre-wrap">{note.costumeNotes}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">暂无服装提示</p>
                          )}
                        </TabsContent>

                        <TabsContent value="makeup" className="mt-4">
                          {note.makeupNotes ? (
                            <p className="text-sm whitespace-pre-wrap">{note.makeupNotes}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">暂无化妆提示</p>
                          )}
                        </TabsContent>

                        <TabsContent value="props" className="mt-4">
                          {note.propsRequired && (note.propsRequired as string[]).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {(note.propsRequired as string[]).map((prop, index) => (
                                <Badge key={index} variant="secondary">
                                  {prop}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">暂无道具需求</p>
                          )}
                        </TabsContent>

                        <TabsContent value="continuity" className="mt-4">
                          {note.continuityNotes ? (
                            <div className="space-y-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <h4 className="text-sm font-medium">接戏提醒</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                                    {note.continuityNotes}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              无特殊接戏要求
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : selectedScene ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Shirt className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">暂无服化道提示</h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                    点击"生成服化道提示"，AI将为您分析场次需求
                  </p>
                  <Button className="mt-6" onClick={handleGenerate} data-testid="button-generate-first-production">
                    <Wand2 className="mr-2 h-4 w-4" />
                    生成服化道提示
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Shirt className="h-16 w-16 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">请选择场次</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    从左侧选择一个场次来查看或生成服化道提示
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
