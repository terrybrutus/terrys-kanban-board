import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  BarChart2,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  Tag as TagIcon,
  Users,
} from "lucide-react";
import type { Card, ColumnView, Tag } from "../backend.d";
import {
  useCards,
  useColumns,
  useProjectSummary,
  useUsers,
} from "../hooks/useQueries";
import type { FilterState } from "./FilterBar";

interface DashboardTabProps {
  projectId: bigint | null;
  projectTags: Tag[];
  columns: ColumnView[];
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

const COLUMN_PROGRESS_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#ec4899", // pink
];

function ProgressRow({
  label,
  count,
  total,
  color,
  avatar,
  suffix,
}: {
  label: string;
  count: number;
  total: number;
  color?: string;
  avatar?: React.ReactNode;
  suffix?: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      {avatar ? (
        <div className="shrink-0">{avatar}</div>
      ) : color ? (
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="text-sm text-foreground w-32 shrink-0 truncate">
        {label}
        {suffix && (
          <span className="ml-1 text-emerald-600 font-semibold text-[10px]">
            {suffix}
          </span>
        )}
      </span>
      <div
        className="flex-1 bg-secondary rounded-full overflow-hidden border border-black/70 dark:border-white/20"
        style={{ minHeight: "8px" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: color ?? "hsl(var(--primary))",
            minHeight: "4px",
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right shrink-0 font-mono">
        {count}
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const INITIALS_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function getInitialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

function isOverdue(card: Card): boolean {
  return card.dueDate != null && Number(card.dueDate) / 1_000_000 < Date.now();
}

function formatDueDate(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function DashboardTab({
  projectId,
  projectTags,
  columns: columnsProp,
  onApplyFilter,
}: DashboardTabProps) {
  const { data: summary, isLoading: summaryLoading } =
    useProjectSummary(projectId);
  const { data: columnsData = [], isLoading: colsLoading } =
    useColumns(projectId);
  const { data: cards = [], isLoading: cardsLoading } = useCards(projectId);
  const { data: users = [], isLoading: usersLoading } = useUsers();
  // Use columns from props (already fetched in App) or fall back to local fetch
  const columns = columnsProp.length > 0 ? columnsProp : columnsData;

  const isLoading =
    summaryLoading || colsLoading || cardsLoading || usersLoading;

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
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-full rounded" />
          ))}
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

  // Derived data
  const activeCards = cards.filter((c) => !c.isArchived);
  const totalActive = activeCards.length;
  const overdueCards = activeCards.filter(isOverdue);

  // Completion = cards in columns flagged as "complete"
  const completeColumnIds = new Set(
    columns.filter((c) => c.isComplete).map((c) => c.id.toString()),
  );
  const completedCards = activeCards.filter((c) =>
    completeColumnIds.has(c.columnId.toString()),
  );
  const completedCount = completedCards.length;
  const completionRate =
    totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;

  // Cards by column
  const columnCounts = columns.map((col) => ({
    col,
    count: activeCards.filter((c) => col.cardIds.some((id) => id === c.id))
      .length,
  }));

  // Cards by assignee
  const assigneeCounts = users.map((user) => ({
    user,
    count: activeCards.filter(
      (c) => c.assignedUserId?.toString() === user.id.toString(),
    ).length,
  }));
  const unassignedCount = activeCards.filter(
    (c) => c.assignedUserId == null,
  ).length;

  return (
    <ScrollArea className="flex-1">
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
              value={totalActive}
              icon={<CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
              accent="border-border"
              description="Active cards on the board"
            />
            <StatCard
              label="Overdue"
              value={Number(summary.overdueCount)}
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
              label="Completion"
              value={completionRate}
              icon={<BarChart2 className="h-5 w-5 text-emerald-500" />}
              accent={
                completionRate > 50
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border"
              }
              description={`${completedCount} of ${totalActive} cards in complete columns (${completionRate}%)`}
            />
            <StatCard
              label="Due Soon"
              value={Number(summary.dueSoonCount)}
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
          </div>
        </div>

        {/* Cards by column */}
        {columns.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              Cards by Column
            </h2>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {columnCounts.map(({ col, count }, idx) => (
                <ProgressRow
                  key={col.id.toString()}
                  label={col.name}
                  count={count}
                  total={totalActive}
                  color={
                    COLUMN_PROGRESS_COLORS[idx % COLUMN_PROGRESS_COLORS.length]
                  }
                  suffix={col.isComplete ? " ✓" : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cards by assignee */}
        {users.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Progress by Assignee
            </h2>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {assigneeCounts.map(({ user, count }) => {
                const color = getInitialsColor(user.name);
                return (
                  <ProgressRow
                    key={user.id.toString()}
                    label={user.name}
                    count={count}
                    total={totalActive}
                    color={color}
                    avatar={
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {getInitials(user.name)}
                      </div>
                    }
                  />
                );
              })}
              {unassignedCount > 0 && (
                <ProgressRow
                  label="Unassigned"
                  count={unassignedCount}
                  total={totalActive}
                  color="hsl(var(--muted-foreground) / 0.4)"
                  avatar={
                    <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 shrink-0" />
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Tag usage */}
        {summary.tagCounts.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
              <TagIcon className="h-4 w-4 text-muted-foreground" />
              Tag Usage
            </h2>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {summary.tagCounts.map(([tagId, count]) => {
                const tag = projectTags.find(
                  (t) => t.id.toString() === tagId.toString(),
                );
                if (!tag) return null;
                return (
                  <ProgressRow
                    key={tagId.toString()}
                    label={tag.name}
                    count={Number(count)}
                    total={totalActive}
                    color={tag.color}
                  />
                );
              })}
            </div>
            {/* Clickable tag chips */}
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
                    onClick={() =>
                      onApplyFilter({ tagIds: [tag.id.toString()] })
                    }
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:opacity-85 hover:scale-105"
                    style={{
                      backgroundColor: tag.color,
                      color: "#ffffff",
                      borderColor: tag.color,
                    }}
                    title="Click to filter by this tag"
                  >
                    {tag.name}
                    <span
                      className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                    >
                      {count.toString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Overdue cards list */}
        {overdueCards.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display font-semibold text-base text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Overdue Cards ({overdueCards.length})
            </h2>
            <div className="space-y-2">
              {overdueCards.map((card) => {
                const col = columns.find((c) =>
                  c.cardIds.some((id) => id === card.id),
                );
                const assignee = users.find(
                  (u) => u.id.toString() === card.assignedUserId?.toString(),
                );
                return (
                  <div
                    key={card.id.toString()}
                    className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {card.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {col?.name ?? "Unknown column"} ·{" "}
                        {assignee?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <span className="text-xs text-destructive font-medium shrink-0">
                      {card.dueDate != null ? formatDueDate(card.dueDate) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalActive === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No active cards on this board yet.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
