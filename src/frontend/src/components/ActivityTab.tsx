import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityIcon, Clock } from "lucide-react";
import type { Revision } from "../backend.d";
import { useRevisions } from "../hooks/useQueries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToMs(ts: bigint): number {
  return Number(ts) / 1_000_000;
}

function formatRelative(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  return `${diffDay} days ago`;
}

function formatAbsolute(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDayLabel(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatRevisionType(revisionType: string): string {
  return revisionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRevisionTypeBadgeStyle(revisionType: string): string {
  const type = revisionType.toLowerCase();
  if (type.includes("created") || type.includes("create")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  if (type.includes("deleted") || type.includes("delete")) {
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  }
  if (type.includes("moved") || type.includes("move")) {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
  if (
    type.includes("updated") ||
    type.includes("update") ||
    type.includes("renamed") ||
    type.includes("rename")
  ) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  }
  if (type.includes("assigned") || type.includes("assign")) {
    return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
  }
  return "bg-secondary text-muted-foreground border-border";
}

// Color derived from name hash
function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Revision Entry ───────────────────────────────────────────────────────────

function RevisionEntry({ revision }: { revision: Revision }) {
  const ms = tsToMs(revision.timestamp);
  const relative = formatRelative(ms);
  const absolute = formatAbsolute(ms);
  const initials =
    revision.actorName
      .split(" ")
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="flex gap-3 items-start py-3 px-4 rounded-lg hover:bg-secondary/40 transition-colors group">
      {/* Avatar */}
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5 ${getAvatarColor(revision.actorName)}`}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-foreground">
            {revision.actorName}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 font-medium border ${getRevisionTypeBadgeStyle(revision.revisionType)}`}
          >
            {formatRevisionType(revision.revisionType)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
          {revision.description}
        </p>
      </div>

      {/* Timestamp */}
      <div
        className="shrink-0 text-xs text-muted-foreground/70 group-hover:text-muted-foreground transition-colors whitespace-nowrap mt-0.5 cursor-default"
        title={absolute}
      >
        {relative}
      </div>
    </div>
  );
}

// ─── Day Group ────────────────────────────────────────────────────────────────

function DayGroup({
  label,
  revisions,
}: { label: string; revisions: Revision[] }) {
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 py-2 px-4 bg-background/90 backdrop-blur-sm">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="divide-y divide-border/50">
        {revisions.map((rev) => (
          <RevisionEntry key={rev.id.toString()} revision={rev} />
        ))}
      </div>
    </div>
  );
}

// ─── ActivityTab ──────────────────────────────────────────────────────────────

interface ActivityTabProps {
  projectId: bigint | null;
}

export default function ActivityTab({ projectId }: ActivityTabProps) {
  const { data: revisions = [], isLoading } = useRevisions(projectId);

  // Sort newest first
  const sorted = [...revisions].sort((a, b) => {
    return Number(b.timestamp - a.timestamp);
  });

  // Group by day
  const groups: { label: string; revisions: Revision[] }[] = [];
  const seenDays = new Map<string, number>();

  for (const rev of sorted) {
    const ms = tsToMs(rev.timestamp);
    const dayKey = getDayLabel(ms);
    if (!seenDays.has(dayKey)) {
      seenDays.set(dayKey, groups.length);
      groups.push({ label: dayKey, revisions: [] });
    }
    groups[seenDays.get(dayKey)!].revisions.push(rev);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground leading-none">
              Activity Feed
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Full revision history — every change tracked with timestamps
            </p>
          </div>
          {!isLoading && revisions.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground bg-secondary rounded-full px-2.5 py-1">
              {revisions.length} revision{revisions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 items-start py-3 px-4">
                <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-3 w-16 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && revisions.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center">
              <ActivityIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                No activity yet
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Actions like creating cards, moving them, or assigning users
                will appear here.
              </p>
            </div>
          </div>
        )}

        {/* Groups */}
        {!isLoading && groups.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/50 bg-card">
            {groups.map((group) => (
              <DayGroup
                key={group.label}
                label={group.label}
                revisions={group.revisions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
