import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  Tag as TagIcon,
  Users,
} from "lucide-react";
import type { Tag } from "../backend.d";
import { useProjectSummary } from "../hooks/useQueries";
import type { FilterState } from "./FilterBar";

interface DashboardTabProps {
  projectId: bigint | null;
  projectTags: Tag[];
  onApplyFilter: (filters: Partial<FilterState>) => void;
}

interface StatCardProps {
  label: string;
  value: number | bigint;
  icon: React.ReactNode;
  accent: string;
  onClick?: () => void;
  description?: string;
}

function StatCard({
  label,
  value,
  icon,
  accent,
  onClick,
  description,
}: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-3 rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : "cursor-default"
      } ${accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="text-3xl font-display font-bold text-foreground leading-none">
            {value.toString()}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-secondary/60">{icon}</div>
      </div>
      {onClick && (
        <p className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
          Click to filter →
        </p>
      )}
    </button>
  );
}

export default function DashboardTab({
  projectId,
  projectTags,
  onApplyFilter,
}: DashboardTabProps) {
  const { data: summary, isLoading } = useProjectSummary(projectId);

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center">
          <LayoutDashboard className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Select a project to see its dashboard.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-12" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Failed to load dashboard.
        </p>
      </div>
    );
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Stat cards */}
      <div>
        <h2 className="font-display font-semibold text-base text-foreground mb-4 flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          Board Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Cards"
            value={summary.totalCards}
            icon={<CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
            accent="border-border"
            description="Active cards on the board"
          />
          <StatCard
            label="Overdue"
            value={summary.overdueCount}
            icon={<AlertCircle className="h-5 w-5 text-destructive" />}
            accent={
              Number(summary.overdueCount) > 0
                ? "border-destructive/30 bg-destructive/5"
                : "border-border"
            }
            onClick={
              Number(summary.overdueCount) > 0
                ? () => {
                    const toDate = new Date(now).toISOString().slice(0, 10);
                    onApplyFilter({
                      dateField: "dueDate",
                      dateFrom: "",
                      dateTo: toDate,
                    });
                  }
                : undefined
            }
            description={
              Number(summary.overdueCount) > 0
                ? "Past due date"
                : "All on track"
            }
          />
          <StatCard
            label="Due Soon"
            value={summary.dueSoonCount}
            icon={<Calendar className="h-5 w-5 text-amber-500" />}
            accent={
              Number(summary.dueSoonCount) > 0
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border"
            }
            onClick={
              Number(summary.dueSoonCount) > 0
                ? () => {
                    const fromDate = new Date(now).toISOString().slice(0, 10);
                    const toDate = new Date(now + sevenDays)
                      .toISOString()
                      .slice(0, 10);
                    onApplyFilter({
                      dateField: "dueDate",
                      dateFrom: fromDate,
                      dateTo: toDate,
                    });
                  }
                : undefined
            }
            description="Due within 7 days"
          />
          <StatCard
            label="Unassigned"
            value={summary.unassignedCount}
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
            accent={
              Number(summary.unassignedCount) > 0
                ? "border-muted-foreground/20"
                : "border-border"
            }
            onClick={
              Number(summary.unassignedCount) > 0
                ? () => onApplyFilter({ unassignedOnly: true })
                : undefined
            }
            description="No assignee set"
          />
        </div>
      </div>

      {/* Tags breakdown */}
      {summary.tagCounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-muted-foreground" />
            Cards by Tag
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.tagCounts.map(([tagId, count]) => {
              const tag = projectTags.find(
                (t) => t.id.toString() === tagId.toString(),
              );
              if (!tag) return null;
              return (
                <button
                  key={tagId.toString()}
                  type="button"
                  onClick={() => onApplyFilter({ tagIds: [tag.id.toString()] })}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:opacity-80 hover:scale-105"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}40`,
                  }}
                  title="Click to filter by this tag"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  <span
                    className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: `${tag.color}30` }}
                  >
                    {count.toString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {Number(summary.totalCards) === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No active cards on this board yet.
        </div>
      )}
    </div>
  );
}
