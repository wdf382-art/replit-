import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ScriptAnalysis({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const [, setLocation] = useLocation();

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "analysis"],
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/50">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">剧本数据分析</h1>
            <p className="text-muted-foreground">
              {project?.title || "项目"} 的可视化数据报告
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle>角色台词比例</CardTitle>
              <CardDescription>各主要角色在剧本中的对白出现次数占比</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {analysis?.characterDialogue?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analysis.characterDialogue}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      innerRadius={60}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {analysis.characterDialogue.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={ { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' } }
                      itemStyle={ { color: 'hsl(var(--foreground))' } }
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>暂无台词数据</p>
                  <p className="text-xs">请确保剧本中包含角色对白且已正确解析</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle>场景时长分布</CardTitle>
              <CardDescription>各场次预计拍摄时长（基于动作与对白量估算）</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {analysis?.sceneDurations?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.sceneDurations} margin={ { top: 20, right: 30, left: 20, bottom: 20 } }>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="sceneNumber" 
                      label={ { value: '场次', position: 'insideBottom', offset: -10 } }
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      label={ { value: '预计秒数', angle: -90, position: 'insideLeft', offset: 10 } }
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      cursor={ { fill: 'hsl(var(--muted)/0.2)' } }
                      contentStyle={ { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' } }
                    />
                    <Bar dataKey="duration" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="预计时长(秒)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>暂无场景数据</p>
                  <p className="text-xs">请先生成或解析剧本场次</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
