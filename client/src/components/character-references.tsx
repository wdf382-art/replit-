import { useState, useRef, useEffect } from "react";
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
  ChevronLeft,
  Wand2,
  X,
  Eye,
  History,
  Maximize2,
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
  imageProviders,
  type CharacterRoleType,
  type CharacterAssetType,
  type CharacterAssetReference,
  type CharacterImageVariant,
  type CharacterPoseType,
  type ImageProvider,
} from "@shared/schema";

const imageProviderLabels: Record<ImageProvider, string> = {
  openai: "OpenAI DALL-E",
  gemini: "NANO BANANA PRO",
  jimeng: "记梦 4.0",
  kling: "可灵",
  hailuo: "海螺",
  tongyi: "通义万象",
};

const availableProviders: ImageProvider[] = ["openai", "gemini"];

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
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; label: string } | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ImageProvider>("openai");
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

  const { data: versionNumbers } = useQuery<number[]>({
    queryKey: ["/api/characters", previewCharacterId, "image-versions"],
    queryFn: async () => {
      if (!previewCharacterId) return [];
      const res = await fetch(`/api/characters/${previewCharacterId}/image-versions`);
      return res.json();
    },
    enabled: !!previewCharacterId,
  });

  const sortedVersionNumbers = versionNumbers ? [...versionNumbers].sort((a, b) => b - a) : [];
  const latestVersion = sortedVersionNumbers[0] ?? null;

  useEffect(() => {
    if (sortedVersionNumbers.length > 0 && selectedVersion === null) {
      setSelectedVersion(latestVersion);
    }
  }, [sortedVersionNumbers.length, selectedVersion, latestVersion]);

  const effectiveVersion = selectedVersion || latestVersion;

  const { data: imageVariants, refetch: refetchVariants } = useQuery<CharacterImageVariant[]>({
    queryKey: ["/api/characters", previewCharacterId, "image-variants", effectiveVersion],
    queryFn: async () => {
      if (!previewCharacterId) return [];
      if (effectiveVersion) {
        const res = await fetch(`/api/characters/${previewCharacterId}/image-variants/version/${effectiveVersion}`);
        return res.json();
      }
      const res = await fetch(`/api/characters/${previewCharacterId}/image-variants`);
      return res.json();
    },
    enabled: !!previewCharacterId,
    refetchInterval: (query) => {
      const variants = query.state?.data;
      if (!Array.isArray(variants)) return false;
      const hasGenerating = variants.some(v => v.status === "pending" || v.status === "generating");
      return hasGenerating ? 3000 : false;
    },
  });

  const generateImagesMutation = useMutation({
    mutationFn: async ({ characterId, provider }: { characterId: string; provider: ImageProvider }) => {
      const result = await apiRequest("POST", `/api/characters/${characterId}/generate-images`, { provider });
      return result as { version?: number; batchId?: string };
    },
    onSuccess: (data, { characterId }) => {
      setGeneratingCharacterId(null);
      setPreviewCharacterId(characterId);
      setSelectedVersion(data.version || null);
      queryClient.invalidateQueries({ queryKey: ["/api/characters", characterId, "image-versions"] });
      refetchVariants();
      toast({
        title: "开始生成",
        description: `正在使用 ${imageProviderLabels[selectedProvider]} 为角色生成第${data.version || 1}版定妆照，请稍候...`,
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
    generateImagesMutation.mutate({ characterId, provider: selectedProvider });
  };

  const handleOpenPreview = (characterId: string) => {
    setPreviewCharacterId(characterId);
    setSelectedVersion(null);
    setCurrentImageIndex(0);
  };

  const handleRegenerateImages = () => {
    if (previewCharacterId) {
      setGeneratingCharacterId(previewCharacterId);
      generateImagesMutation.mutate({ characterId: previewCharacterId, provider: selectedProvider });
    }
  };

  const handlePreviousImage = () => {
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : 3);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => prev < 3 ? prev + 1 : 0);
  };

  const poseTypes: CharacterPoseType[] = ["full_body", "front_face", "left_profile", "right_profile"];
  const currentVariant = imageVariants?.find(v => v.poseType === poseTypes[currentImageIndex]);

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
                      onClick={() => handleOpenPreview(character.id)}
                      data-testid={`button-preview-character-image-${character.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      预览
                    </Button>
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

      <Dialog open={!!previewCharacterId} onOpenChange={(open) => { 
        if (!open) {
          setPreviewCharacterId(null);
          setSelectedVersion(null);
          setCurrentImageIndex(0);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                AI生成定妆照预览
              </span>
              {sortedVersionNumbers.length > 0 && effectiveVersion && (
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={String(effectiveVersion)}
                    onValueChange={(v) => setSelectedVersion(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-32" data-testid="select-version">
                      <SelectValue placeholder="选择版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedVersionNumbers.map((v) => (
                        <SelectItem key={v} value={String(v)}>
                          第{v}版
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              点击图片放大查看，或选择一张图片作为角色形象参考
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="relative">
              <div className="relative aspect-[4/3] rounded-lg border overflow-hidden bg-muted/50">
                {currentVariant?.status === "completed" && currentVariant.imageUrl ? (
                  <>
                    <img
                      src={currentVariant.imageUrl}
                      alt={characterPoseTypeLabels[poseTypes[currentImageIndex]]}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() => setFullscreenImage({ 
                        url: currentVariant.imageUrl!, 
                        label: characterPoseTypeLabels[poseTypes[currentImageIndex]] 
                      })}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setFullscreenImage({ 
                        url: currentVariant.imageUrl!, 
                        label: characterPoseTypeLabels[poseTypes[currentImageIndex]] 
                      })}
                      data-testid="button-fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute bottom-2 right-2"
                      onClick={() => {
                        if (previewCharacterId && currentVariant.id) {
                          applyImageMutation.mutate({
                            characterId: previewCharacterId,
                            variantId: currentVariant.id,
                          });
                        }
                      }}
                      disabled={applyImageMutation.isPending}
                      data-testid={`button-apply-variant-current`}
                    >
                      应用此图
                    </Button>
                  </>
                ) : currentVariant?.status === "failed" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive">
                    <X className="h-12 w-12 mb-2" />
                    <span className="text-lg">生成失败</span>
                    <span className="text-sm px-4 text-center mt-1 max-w-md">{currentVariant.errorMessage}</span>
                  </div>
                ) : currentVariant?.status === "generating" || currentVariant?.status === "pending" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <RefreshCw className="h-12 w-12 mb-2 animate-spin" />
                    <span className="text-lg">生成中...</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <span className="text-lg">暂无图片</span>
                    <span className="text-sm mt-1">请点击"生成新版本"开始生成</span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={handlePreviousImage}
                data-testid="button-prev-image"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={handleNextImage}
                data-testid="button-next-image"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            <div className="text-center text-sm font-medium">
              {characterPoseTypeLabels[poseTypes[currentImageIndex]]} ({currentImageIndex + 1}/4)
            </div>

            <div className="grid grid-cols-4 gap-2">
              {poseTypes.map((poseType, index) => {
                const variant = imageVariants?.find(v => v.poseType === poseType);
                const isActive = index === currentImageIndex;
                return (
                  <div 
                    key={poseType} 
                    className={`relative aspect-square rounded-lg border overflow-hidden bg-muted/50 cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                    onClick={() => setCurrentImageIndex(index)}
                    data-testid={`thumbnail-${poseType}`}
                  >
                    {variant?.status === "completed" && variant.imageUrl ? (
                      <img
                        src={variant.imageUrl}
                        alt={characterPoseTypeLabels[poseType]}
                        className="w-full h-full object-cover"
                      />
                    ) : variant?.status === "generating" || variant?.status === "pending" ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : variant?.status === "failed" ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <X className="h-6 w-6 text-destructive" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                      {characterPoseTypeLabels[poseType]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select
                value={selectedProvider}
                onValueChange={(v) => setSelectedProvider(v as ImageProvider)}
              >
                <SelectTrigger className="w-44" data-testid="select-provider">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {imageProviderLabels[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="default" 
                onClick={handleRegenerateImages}
                disabled={generatingCharacterId === previewCharacterId}
                data-testid="button-regenerate"
              >
                {generatingCharacterId === previewCharacterId ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                生成新版本
              </Button>
            </div>
            <Button variant="outline" onClick={() => setPreviewCharacterId(null)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
          <DialogHeader>
            <DialogTitle>{fullscreenImage?.label}</DialogTitle>
          </DialogHeader>
          {fullscreenImage && (
            <div className="flex items-center justify-center">
              <img
                src={fullscreenImage.url}
                alt={fullscreenImage.label}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
