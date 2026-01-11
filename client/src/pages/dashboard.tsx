import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  FileText,
  FolderOpen,
  Image,
  Clock,
  ArrowRight,
  Film,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@shared/schema";
import { projectTypeInfo } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const recentProjects = projects?.slice(0, 4) || [];
  const totalProjects = projects?.length || 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            欢迎使用影视制作助手
          </h1>
          <p className="text-muted-foreground">
            AI驱动的专业影视前期筹备工具，助您高效完成创意到分镜的全流程
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/projects?new=true">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="card-new-project">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">新建项目</CardTitle>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">开始创作</div>
                <p className="text-xs text-muted-foreground mt-1">
                  创建新的影视项目
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/script">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="card-script-editor">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">剧本编辑</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">AI 剧本</div>
                <p className="text-xs text-muted-foreground mt-1">
                  智能生成与优化剧本
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/storyboard">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="card-storyboard">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">智能分镜</CardTitle>
                <Image className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">导演风格</div>
                <p className="text-xs text-muted-foreground mt-1">
                  15+大师风格分镜生成
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="h-full" data-testid="card-stats">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">项目统计</CardTitle>
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProjects}</div>
              <p className="text-xs text-muted-foreground mt-1">
                个活跃项目
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" data-testid="card-recent-projects">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>最近项目</CardTitle>
                <CardDescription>继续您的创作工作</CardDescription>
              </div>
              <Link href="/projects">
                <Button variant="ghost" size="sm" data-testid="button-view-all-projects">
                  查看全部
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentProjects.length > 0 ? (
                <div className="space-y-4">
                  {recentProjects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div
                        className="flex items-center gap-4 p-3 -mx-3 rounded-md hover-elevate cursor-pointer"
                        data-testid={`card-project-${project.id}`}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                          <Film className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{project.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {projectTypeInfo[project.type as keyof typeof projectTypeInfo]?.nameCN || project.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(project.createdAt).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">暂无项目</p>
                  <Link href="/projects?new=true">
                    <Button className="mt-4" data-testid="button-create-first-project">
                      <Plus className="mr-2 h-4 w-4" />
                      创建第一个项目
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-features">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                核心功能
              </CardTitle>
              <CardDescription>AI驱动的全流程工具</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">剧本生成</h4>
                    <p className="text-xs text-muted-foreground">
                      将创意转化为标准剧本格式
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Image className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">智能分镜</h4>
                    <p className="text-xs text-muted-foreground">
                      15+导演风格分镜绘制
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Film className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">表演指导</h4>
                    <p className="text-xs text-muted-foreground">
                      专业导演级表演提示
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
