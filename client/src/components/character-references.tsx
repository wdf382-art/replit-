import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  User,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  Shirt,
  Footprints,
  Package,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  Wand2,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  characterRoleTypeLabels,
  characterAssetTypeLabels,
  characterPoseTypeLabels,
  type CharacterRoleType,
  type CharacterAssetType,
  type CharacterAssetReference,
  type CharacterImageVariant,
  type CharacterPoseType,
} from "@shared/schema";

interface CharacterWithAssets {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  roleType: CharacterRoleType | null;
  imageReferenceUrl: string | null;
  imageReferencePrompt: string | null;
  isAutoExtracted: boolean | null;
  createdAt: Date;
  assets: {
    clothing: CharacterAssetReference[];
    shoe: CharacterAssetReference[];
    prop: CharacterAssetReference[];
  };
}

interface CharacterReferencesProps {
  projectId: string | undefined;
}

export function CharacterReferences({ projectId }: CharacterReferencesProps) {
  const { toast } = useToast();
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadingCharacterId, setUploadingCharacterId] = useState<string | null>(null);
  const [uploadingAssetType, setUploadingAssetType] = useState<CharacterAssetType | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newCharacterRole, setNewCharacterRole] = useState<CharacterRoleType>("supporting");
  const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null);
  const [previewCharacterId, setPreviewCharacterId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);

  const { data: characters, isLoading } = useQuery<CharacterWithAssets[]>({
    queryKey: [`/api/projects/${projectId}/characters/references`],
    enabled: !!projectId,
    placeholderData: [],
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("No project selected");
      return apiRequest("POST", `/api/projects/${projectId}/characters/extract`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      setIsExtracting(false);
      toast({
        title: "角色提取完成",
        description: "已从剧本中提取所有角色信息",
      });
    },
    onError: (error: Error) => {
      setIsExtracting(false);
      toast({
        title: "提取失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ characterId, imageBase64 }: { characterId: string; imageBase64: string }) => {
      return apiRequest("POST", `/api/characters/${characterId}/reference-image`, { imageBase64 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      setUploadingCharacterId(null);
      toast({
        title: "上传成功",
        description: "角色形象已更新",
      });
    },
    onError: (error: Error) => {
      setUploadingCharacterId(null);
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadAssetMutation = useMutation({
    mutationFn: async ({ characterId, assetType, imageUrl, description }: { 
      characterId: string; 
      assetType: CharacterAssetType; 
      imageUrl: string;
      description?: string;
    }) => {
      return apiRequest("POST", `/api/characters/${characterId}/assets`, { assetType, imageUrl, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      setUploadingAssetType(null);
      toast({
        title: "上传成功",
        description: "参考资料已添加",
      });
    },
    onError: (error: Error) => {
      setUploadingAssetType(null);
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async ({ characterId, assetId }: { characterId: string; assetId: string }) => {
      return apiRequest("DELETE", `/api/characters/${characterId}/assets/${assetId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      toast({
        title: "删除成功",
      });
    },
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: async (characterId: string) => {
      return apiRequest("DELETE", `/api/characters/${characterId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "删除成功",
      });
    },
  });

  const createCharacterMutation = useMutation({
    mutationFn: async ({ name, roleType }: { name: string; roleType: CharacterRoleType }) => {
      if (!projectId) throw new Error("No project selected");
      return apiRequest("POST", `/api/characters`, { projectId, name, roleType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      setShowAddDialog(false);
      setNewCharacterName("");
      setNewCharacterRole("supporting");
      toast({
        title: "创建成功",
        description: "新角色已添加",
      });
    },
  });

  const { data: imageVariants, refetch: refetchVariants } = useQuery<CharacterImageVariant[]>({
    queryKey: ["/api/characters", previewCharacterId, "image-variants"],
    queryFn: async () => {
      if (!previewCharacterId) return [];
      const res = await fetch(`/api/characters/${previewCharacterId}/image-variants`);
      return res.json();
    },
    enabled: !!previewCharacterId,
    refetchInterval: (data) => {
      const hasGenerating = data?.state?.data?.some(v => v.status === "pending" || v.status === "generating");
      return hasGenerating ? 3000 : false;
    },
  });

  const generateImagesMutation = useMutation({
    mutationFn: async (characterId: string) => {
      return apiRequest("POST", `/api/characters/${characterId}/generate-images`, {});
    },
    onSuccess: (_, characterId) => {
      setGeneratingCharacterId(null);
      setPreviewCharacterId(characterId);
      refetchVariants();
      toast({
        title: "开始生成",
        description: "正在为角色生成4张定妆照，请稍候...",
      });
    },
    onError: (error: Error) => {
      setGeneratingCharacterId(null);
      toast({
        title: "生成失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyImageMutation = useMutation({
    mutationFn: async ({ characterId, variantId }: { characterId: string; variantId: string }) => {
      return apiRequest("POST", `/api/characters/${characterId}/image-variants/${variantId}/apply`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/characters/references`] });
      setPreviewCharacterId(null);
      toast({
        title: "应用成功",
        description: "已将选中的图片设为角色形象",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "应用失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateImages = (characterId: string) => {
    setGeneratingCharacterId(characterId);
    generateImagesMutation.mutate(characterId);
  };

  const handleExtract = () => {
    setIsExtracting(true);
    extractMutation.mutate();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, characterId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setUploadingCharacterId(characterId);
      uploadImageMutation.mutate({ characterId, imageBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, characterId: string, assetType: CharacterAssetType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setUploadingAssetType(assetType);
      uploadAssetMutation.mutate({ characterId, assetType, imageUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const getRoleColor = (roleType: CharacterRoleType | null) => {
    switch (roleType) {
      case "male_lead":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "female_lead":
        return "bg-pink-500/10 text-pink-600 border-pink-500/30";
      case "antagonist_1":
      case "antagonist_2":
        return "bg-red-500/10 text-red-600 border-red-500/30";
      case "supporting":
        return "bg-green-500/10 text-green-600 border-green-500/30";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/30";
    }
  };

  if (!projectId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">请先选择项目</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            角色形象参考
          </h2>
          <p className="text-sm text-muted-foreground">
            管理角色形象，用于分镜图片生成时保持人物形象一致
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-character">
                <Plus className="mr-2 h-4 w-4" />
                添加角色
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加新角色</DialogTitle>
                <DialogDescription>手动添加一个新角色</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium">角色名称</label>
                  <Input
                    value={newCharacterName}
                    onChange={(e) => setNewCharacterName(e.target.value)}
                    placeholder="输入角色名称"
                    data-testid="input-character-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">角色类型</label>
                  <Select value={newCharacterRole} onValueChange={(v) => setNewCharacterRole(v as CharacterRoleType)}>
                    <SelectTrigger data-testid="select-character-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(characterRoleTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createCharacterMutation.mutate({ name: newCharacterName, roleType: newCharacterRole })}
                  disabled={!newCharacterName.trim() || createCharacterMutation.isPending}
                  data-testid="button-confirm-add-character"
                >
                  确认添加
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={handleExtract}
            disabled={isExtracting}
            data-testid="button-extract-characters"
          >
            {isExtracting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                提取中...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                从剧本提取角色
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : characters && characters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((character) => (
            <Card key={character.id} className="overflow-hidden" data-testid={`card-character-${character.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {character.name}
                      {character.roleType && (
                        <Badge variant="outline" className={getRoleColor(character.roleType)}>
                          {characterRoleTypeLabels[character.roleType]}
                        </Badge>
                      )}
                    </CardTitle>
                    {character.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {character.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("确定要删除此角色吗？")) {
                        deleteCharacterMutation.mutate(character.id);
                      }
                    }}
                    data-testid={`button-delete-character-${character.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative aspect-square rounded-md border overflow-hidden bg-muted/50">
                  {character.imageReferenceUrl ? (
                    <img
                      src={character.imageReferenceUrl}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-10 w-10 mb-2" />
                      <span className="text-sm">待上传形象</span>
                      {character.imageReferencePrompt && (
                        <p className="text-xs text-center px-4 mt-2 line-clamp-3">
                          AI提示词: {character.imageReferencePrompt}
                        </p>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, character.id)}
                    data-testid={`input-upload-character-image-${character.id}`}
                  />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleGenerateImages(character.id)}
                      disabled={generatingCharacterId === character.id}
                      data-testid={`button-generate-character-image-${character.id}`}
                    >
                      {generatingCharacterId === character.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-1" />
                          AI生成
                        </>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const input = document.querySelector(`input[data-testid="input-upload-character-image-${character.id}"]`) as HTMLInputElement;
                        input?.click();
                      }}
                      disabled={uploadingCharacterId === character.id}
                      data-testid={`button-upload-character-image-${character.id}`}
                    >
                      {uploadingCharacterId === character.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          上传
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Collapsible
                  open={expandedCharacter === character.id}
                  onOpenChange={(open) => setExpandedCharacter(open ? character.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between" data-testid={`button-toggle-assets-${character.id}`}>
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        附属参考
                        <Badge variant="secondary" className="ml-1">
                          {(character.assets.clothing.length + character.assets.shoe.length + character.assets.prop.length)}
                        </Badge>
                      </span>
                      {expandedCharacter === character.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {(["clothing", "shoe", "prop"] as CharacterAssetType[]).map((assetType) => (
                      <div key={assetType} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium flex items-center gap-1">
                            {assetType === "clothing" && <Shirt className="h-3 w-3" />}
                            {assetType === "shoe" && <Footprints className="h-3 w-3" />}
                            {assetType === "prop" && <Package className="h-3 w-3" />}
                            {characterAssetTypeLabels[assetType]}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleAssetUpload(e, character.id, assetType)}
                            data-testid={`input-upload-asset-${character.id}-${assetType}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const input = document.querySelector(`input[data-testid="input-upload-asset-${character.id}-${assetType}"]`) as HTMLInputElement;
                              input?.click();
                            }}
                            disabled={uploadingAssetType === assetType}
                            data-testid={`button-add-asset-${character.id}-${assetType}`}
                          >
                            {uploadingAssetType === assetType ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {character.assets[assetType].map((asset) => (
                            <div
                              key={asset.id}
                              className="relative w-16 h-16 rounded border overflow-hidden group"
                            >
                              <img
                                src={asset.imageUrl}
                                alt={asset.description || assetType}
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={() => deleteAssetMutation.mutate({ characterId: character.id, assetId: asset.id })}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                data-testid={`button-delete-asset-${asset.id}`}
                              >
                                <X className="h-4 w-4 text-white" />
                              </button>
                            </div>
                          ))}
                          {character.assets[assetType].length === 0 && (
                            <span className="text-xs text-muted-foreground">暂无</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">暂无角色</h3>
            <p className="text-sm text-muted-foreground mt-1">
              点击"从剧本提取角色"自动分析剧本中的角色
            </p>
            <Button className="mt-4" onClick={handleExtract} disabled={isExtracting}>
              <Wand2 className="mr-2 h-4 w-4" />
              从剧本提取角色
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!previewCharacterId} onOpenChange={(open) => !open && setPreviewCharacterId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI生成定妆照预览
            </DialogTitle>
            <DialogDescription>
              选择一张图片作为角色形象参考
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {(["full_body", "front_face", "left_profile", "right_profile"] as CharacterPoseType[]).map((poseType) => {
              const variant = imageVariants?.find(v => v.poseType === poseType);
              return (
                <div key={poseType} className="space-y-2">
                  <div className="text-sm font-medium">{characterPoseTypeLabels[poseType]}</div>
                  <div className="relative aspect-square rounded-lg border overflow-hidden bg-muted/50">
                    {variant?.status === "completed" && variant.imageUrl ? (
                      <>
                        <img
                          src={variant.imageUrl}
                          alt={characterPoseTypeLabels[poseType]}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-2 right-2"
                          onClick={() => {
                            if (previewCharacterId && variant.id) {
                              applyImageMutation.mutate({
                                characterId: previewCharacterId,
                                variantId: variant.id,
                              });
                            }
                          }}
                          disabled={applyImageMutation.isPending}
                          data-testid={`button-apply-variant-${poseType}`}
                        >
                          应用此图
                        </Button>
                      </>
                    ) : variant?.status === "failed" ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive">
                        <X className="h-8 w-8 mb-2" />
                        <span className="text-sm">生成失败</span>
                        <span className="text-xs px-4 text-center mt-1">{variant.errorMessage}</span>
                      </div>
                    ) : variant?.status === "generating" || variant?.status === "pending" ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mb-2 animate-spin" />
                        <span className="text-sm">生成中...</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mb-2" />
                        <span className="text-sm">待生成</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewCharacterId(null)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
