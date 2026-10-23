import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  milestone: number;
  description: string;
}

/** 尚未實作的頁面先顯示標題與所屬里程碑，方便對照 docs/ROADMAP.md */
export function PlaceholderPage({ title, milestone, description }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Badge variant="secondary">里程碑 {milestone}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>尚未實作</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          這個頁面會在里程碑 {milestone} 完成；詳細規劃請見 <code>docs/ROADMAP.md</code>。
        </CardContent>
      </Card>
    </main>
  );
}
