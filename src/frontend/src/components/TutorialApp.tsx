import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  BarChart2,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  GripVertical,
  History,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Redo2,
  Send,
  Tag as TagIcon,
  Trash2,
  Undo2,
  UserCircle2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TUser {
  id: string;
  name: string;
  initials: string;
  isMasterAdmin?: boolean;
  isAdmin?: boolean;
}

interface TTag {
  id: string;
  name: string;
  color: string;
}

interface TColumn {
  id: string;
  name: string;
  order: number;
}

interface TChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface TComment {
  id: string;
  text: string;
  authorId: string;
  createdAt: number;
}

interface TCard {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  assigneeId?: string;
  tagIds: string[];
  dueDate?: string; // YYYY-MM-DD
  createdAt: number; // ms timestamp
  isArchived?: boolean;
  checklist: TChecklistItem[];
  comments: TComment[];
}

interface TActivity {
  id: string;
  text: string;
  userId?: string;
  timestamp: number;
}

type TabId = "board" | "users" | "activity" | "dashboard";

// ── Seed Data ─────────────────────────────────────────────────────────────────

const SEED_USERS: TUser[] = [
  {
    id: "u1",
    name: "Terry Brutus",
    initials: "TB",
    isMasterAdmin: true,
    isAdmin: true,
  },
  { id: "u2", name: "Alex R.", initials: "AR", isAdmin: true },
  { id: "u3", name: "Maria T.", initials: "MT" },
  { id: "u4", name: "James K.", initials: "JK" },
  { id: "u5", name: "Sam P.", initials: "SP" },
];

const SEED_TAGS: TTag[] = [
  { id: "t1", name: "Active", color: "#22c55e" },
  { id: "t2", name: "On Hold", color: "#eab308" },
  { id: "t3", name: "Waiting for Approval", color: "#3b82f6" },
  { id: "t4", name: "Priority", color: "#a855f7" },
  { id: "t5", name: "Blocked", color: "#ef4444" },
];

const SEED_COLUMNS: TColumn[] = [
  { id: "c1", name: "Backlog", order: 0 },
  { id: "c2", name: "In Progress", order: 1 },
  { id: "c3", name: "Review", order: 2 },
  { id: "c4", name: "Testing", order: 3 },
  { id: "c5", name: "Staging", order: 4 },
  { id: "c6", name: "Done", order: 5 },
];

const now = Date.now();
const daysAgo = (d: number) => now - d * 86400000;
const daysFromNow = (d: number) =>
  new Date(now + d * 86400000).toISOString().slice(0, 10);
const pastDate = (d: number) => new Date(daysAgo(d)).toISOString().slice(0, 10);

const SEED_CARDS: TCard[] = [
  {
    id: "card1",
    title: "Inspect incoming supplier parts",
    description:
      "Verify all incoming fasteners and sub-assemblies against the Kanban replenishment order. Log results in the quality register and flag any non-conformances immediately.",
    columnId: "c1",
    assigneeId: "u1",
    tagIds: ["t4", "t1"],
    dueDate: daysFromNow(2),
    createdAt: daysAgo(45),
    checklist: [
      { id: "cl1a", text: "Verify quantity against order", checked: true },
      { id: "cl1b", text: "Check for visible defects", checked: true },
      {
        id: "cl1c",
        text: "Log inspection in quality register",
        checked: false,
      },
      {
        id: "cl1d",
        text: "Issue non-conformance report if needed",
        checked: false,
      },
    ],
    comments: [
      {
        id: "cm1a",
        text: "Supplier confirmed 200 units shipped. Tracking number attached to the order card.",
        authorId: "u1",
        createdAt: daysAgo(3),
      },
    ],
  },
  {
    id: "card2",
    title: "Replenish fastener bin — Station 3",
    description:
      "Three-bin replenishment signal triggered. Pull from warehouse stock and refill Station 3 fastener rack. Confirm bin card matches SKU on the rack label.",
    columnId: "c1",
    assigneeId: "u2",
    tagIds: ["t1"],
    dueDate: daysFromNow(1),
    createdAt: daysAgo(30),
    checklist: [],
    comments: [],
  },
  {
    id: "card3",
    title: "Kanban card replenishment — Line A",
    description:
      "The three-bin system on Line A requires a full card set refresh. Create new Kanban cards for each part number, update WIP limits, and post cards at each pull station. This ensures the pull system remains self-regulating with accurate signal quantities.",
    columnId: "c1",
    tagIds: ["t4"],
    createdAt: daysAgo(20),
    checklist: [
      { id: "cl3a", text: "Audit current card quantities", checked: false },
      { id: "cl3b", text: "Print replacement card set", checked: false },
      { id: "cl3c", text: "Post cards at pull stations", checked: false },
    ],
    comments: [],
  },
  {
    id: "card4",
    title: "Chassis assembly — Unit #47",
    description:
      "Full chassis assembly per build specification BOM-4701. Torque all structural fasteners to spec. Attach wiring harness and verify routing matches the assembly drawing before passing to paint.",
    columnId: "c2",
    assigneeId: "u3",
    tagIds: ["t1", "t4"],
    dueDate: daysFromNow(4),
    createdAt: daysAgo(50),
    checklist: [
      { id: "cl4a", text: "Mount front subframe", checked: true },
      { id: "cl4b", text: "Torque structural bolts to 120Nm", checked: true },
      { id: "cl4c", text: "Route and secure wiring harness", checked: false },
      {
        id: "cl4d",
        text: "Final visual inspection before paint",
        checked: false,
      },
    ],
    comments: [
      {
        id: "cm4a",
        text: "Front subframe mounted. Left wiring channel had a routing conflict — resolved by re-clipping harness at frame point F-7.",
        authorId: "u3",
        createdAt: daysAgo(2),
      },
      {
        id: "cm4b",
        text: "Good catch on the routing. Make sure to note it in the assembly SOP for future builds.",
        authorId: "u1",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "card5",
    title: "Quality check — Paint Line B",
    description:
      "Conduct scheduled quality audit of Paint Line B output. Measure coating thickness on 5 sample panels, check for runs, orange peel, or color deviation. Record results on QA form QF-22B.",
    columnId: "c2",
    assigneeId: "u4",
    tagIds: ["t1"],
    createdAt: daysAgo(10),
    checklist: [
      {
        id: "cl5a",
        text: "Measure coating thickness on 5 panels",
        checked: true,
      },
      { id: "cl5b", text: "Inspect for surface defects", checked: false },
      { id: "cl5c", text: "Record results on QF-22B", checked: false },
    ],
    comments: [],
  },
  {
    id: "card6",
    title: "Weld joint inspection report",
    description:
      "Complete the weld joint inspection for Units #44–#47. All structural welds must be verified by visual and dimensional check per WPS-10 standard. Submit signed report to engineering for review and sign-off.",
    columnId: "c3",
    assigneeId: "u1",
    tagIds: ["t3"],
    dueDate: daysFromNow(3),
    createdAt: daysAgo(35),
    checklist: [],
    comments: [
      {
        id: "cm6a",
        text: "Visual check complete on Units 44 and 45. Dimensional verification pending for 46 and 47.",
        authorId: "u1",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "card7",
    title: "Engine mount torque verification",
    description:
      "Verify all four engine mount bolts on Units #43–#47 are torqued to 85Nm ± 5Nm. Use calibrated torque wrench TW-14. Record readings on form MM-07.",
    columnId: "c3",
    assigneeId: "u5",
    tagIds: ["t1"],
    createdAt: daysAgo(25),
    checklist: [
      { id: "cl7a", text: "Unit #43 — all 4 mounts verified", checked: true },
      { id: "cl7b", text: "Unit #44 — all 4 mounts verified", checked: true },
      { id: "cl7c", text: "Unit #45 — pending", checked: false },
    ],
    comments: [],
  },
  {
    id: "card8",
    title: "Final road test — Unit #44",
    description:
      "Full 30-minute road test per protocol RT-100. Test acceleration, braking, steering response, NVH, and all electrical systems. Defects must be logged and signed off by lead technician before delivery.",
    columnId: "c4",
    assigneeId: "u2",
    tagIds: ["t1", "t4"],
    dueDate: daysFromNow(1),
    createdAt: daysAgo(55),
    checklist: [
      { id: "cl8a", text: "Acceleration and shift quality", checked: true },
      { id: "cl8b", text: "Braking response and ABS function", checked: true },
      {
        id: "cl8c",
        text: "NVH check — cabin noise and vibration",
        checked: false,
      },
      { id: "cl8d", text: "All electrical systems function", checked: false },
    ],
    comments: [
      {
        id: "cm8a",
        text: "Acceleration and shift quality look excellent. Starting NVH check this afternoon.",
        authorId: "u2",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "card9",
    title: "Brake system pressure test",
    description:
      "Hydraulic brake system pressure test on Unit #45. Pressurize to 1200 PSI and hold for 5 minutes. Check for leaks at all fittings. Currently blocked — calibrated test gauge returned to supplier for recertification.",
    columnId: "c4",
    assigneeId: "u3",
    tagIds: ["t5"],
    createdAt: daysAgo(15),
    checklist: [],
    comments: [
      {
        id: "cm9a",
        text: "Blocked — test gauge sent back for calibration recertification. ETA 2 days.",
        authorId: "u3",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "card10",
    title: "Documentation update — Assembly SOP",
    description:
      "Incorporate wiring harness routing change from Unit #47 build into the Assembly SOP. Update diagrams at section 4.3 and submit for engineering sign-off before next production run.",
    columnId: "c4",
    assigneeId: "u4",
    tagIds: ["t2"],
    createdAt: daysAgo(12),
    checklist: [],
    comments: [],
  },
  {
    id: "card11",
    title: "Pre-delivery inspection — Unit #44",
    description:
      "Full pre-delivery inspection per PDI checklist PD-200. Confirm all open items from road test are closed. Photograph exterior, interior, and under-hood. Prepare delivery documentation package.",
    columnId: "c5",
    assigneeId: "u1",
    tagIds: ["t1"],
    dueDate: daysFromNow(2),
    createdAt: daysAgo(60),
    checklist: [
      { id: "cl11a", text: "Exterior condition documented", checked: true },
      { id: "cl11b", text: "Interior and dashboard check", checked: true },
      { id: "cl11c", text: "All road test items closed", checked: false },
      { id: "cl11d", text: "Delivery documentation prepared", checked: false },
    ],
    comments: [],
  },
  {
    id: "card12",
    title: "Customer handoff package — Unit #40",
    description:
      "Prepare and verify the full handoff package for Unit #40: owner's manual, warranty card, service booklet, and signed inspection report. Schedule delivery appointment with dealer contact.",
    columnId: "c5",
    assigneeId: "u5",
    tagIds: ["t1"],
    createdAt: daysAgo(40),
    checklist: [],
    comments: [],
  },
  {
    id: "card13",
    title: "Ship Unit #38 to dealer",
    description:
      "Unit #38 cleared all pre-delivery checks. Transport arranged via logistics partner — pickup scheduled. Confirm bill of lading matches unit VIN and destination dealer code.",
    columnId: "c6",
    assigneeId: "u1",
    tagIds: ["t1"],
    createdAt: daysAgo(70),
    checklist: [],
    comments: [],
  },
  {
    id: "card14",
    title: "Archive build record — Unit #37",
    description:
      "Digitize and archive the complete build record for Unit #37. Upload to document management system under project folder. Confirm all quality sign-offs and test results are attached before archiving.",
    columnId: "c6",
    assigneeId: "u2",
    tagIds: ["t1"],
    dueDate: pastDate(5),
    createdAt: daysAgo(80),
    checklist: [],
    comments: [],
  },
];

const SEED_ACTIVITY: TActivity[] = [
  {
    id: "a1",
    text: "Terry Brutus moved 'Ship Unit #38 to dealer' to Done",
    userId: "u1",
    timestamp: daysAgo(1),
  },
  {
    id: "a2",
    text: "Alex R. started 'Final road test — Unit #44'",
    userId: "u2",
    timestamp: daysAgo(2),
  },
  {
    id: "a3",
    text: "Maria T. updated chassis assembly checklist",
    userId: "u3",
    timestamp: daysAgo(2),
  },
  {
    id: "a4",
    text: "Terry Brutus added comment on 'Chassis assembly — Unit #47'",
    userId: "u1",
    timestamp: daysAgo(1),
  },
  {
    id: "a5",
    text: "Sam P. moved 'Customer handoff package — Unit #40' to Staging",
    userId: "u5",
    timestamp: daysAgo(3),
  },
  {
    id: "a6",
    text: "James K. started 'Quality check — Paint Line B'",
    userId: "u4",
    timestamp: daysAgo(4),
  },
  {
    id: "a7",
    text: "Terry Brutus created project 'Toyota Production Workflow'",
    userId: "u1",
    timestamp: daysAgo(60),
  },
];

// ── Helper functions ──────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelative(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDateStr(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdueStr(dateStr: string): boolean {
  return new Date(`${dateStr}T23:59:59`).getTime() < Date.now();
}

function isDueSoonStr(dateStr: string): boolean {
  const due = new Date(`${dateStr}T23:59:59`).getTime();
  const diff = due - Date.now();
  return diff >= 0 && diff < 3 * 86400000;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ACCENT_CLASSES = [
  "col-accent-0",
  "col-accent-1",
  "col-accent-2",
  "col-accent-3",
  "col-accent-4",
  "col-accent-5",
];

// ── Tutorial Steps ────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    title: "The Board",
    body: "Each column represents a stage in the workflow. Cards move left to right as work progresses. This board uses Toyota-inspired Kanban principles — a pull system where work advances only when the next stage is ready.",
  },
  {
    title: "Moving Cards",
    body: "Drag any card to a different column to advance it through the workflow. Try dragging one now — your changes are fully functional and reflect a real production pull system.",
  },
  {
    title: "Card Details",
    body: "Click any card to open its detail view. You can edit the title and description, assign a team member, set a due date, manage a checklist with progress tracking, and add comments attributed to any user.",
  },
  {
    title: "Creating Cards",
    body: "Click the + button at the bottom of any column to add a new card. Use Quick Add (⚡) for speed — type #TagName and @UserName shortcuts to set tags and assignees inline.",
  },
  {
    title: "Filtering & Multi-select",
    body: "Use the filter bar to narrow cards by assignee, tag, or keyword. Hold Shift and click cards to multi-select, then bulk-move them at once using the toolbar that appears.",
  },
  {
    title: "Explore Freely",
    body: "That's it! All features are live — try the Activity log, Dashboard tab, and Users tab. Columns can be renamed, reordered by dragging the grip handle, and deleted. Everything resets when you leave.",
  },
];

// ── Tutorial Overlay ──────────────────────────────────────────────────────────

function TutorialOverlay({
  onClose,
  forceOpen,
}: {
  onClose: () => void;
  forceOpen?: boolean;
}) {
  const [step, setStep] = useState<null | number>(null); // null = intro screen

  function handleSkip() {
    if (!forceOpen) {
      sessionStorage.setItem("tutorial_overlay_seen", "1");
    }
    onClose();
  }

  function handleStart() {
    setStep(0);
  }

  function handleNext() {
    if (step === null) return;
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      if (!forceOpen) {
        sessionStorage.setItem("tutorial_overlay_seen", "1");
      }
      onClose();
    }
  }

  const currentStep = step !== null ? TUTORIAL_STEPS[step] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSkip();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleSkip();
      }}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {step === null ? (
          // Intro screen
          <div className="px-8 py-8 text-center space-y-5">
            <div className="h-14 w-14 rounded-2xl col-accent-0 col-accent-bar flex items-center justify-center mx-auto">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-bold text-xl text-foreground">
                Welcome to the Tutorial
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This is a fully interactive Kanban board. Explore every feature
                — nothing is saved.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={handleStart} className="w-full gap-2">
                <BookOpen className="h-4 w-4" />
                Start Tutorial
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full text-muted-foreground"
              >
                Skip
              </Button>
            </div>
          </div>
        ) : (
          // Step screen
          <div className="px-7 py-7 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Step {(step ?? 0) + 1} of {TUTORIAL_STEPS.length}
                </p>
                <h2 className="font-display font-bold text-lg text-foreground">
                  {currentStep?.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleSkip}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full col-accent-0 col-accent-bar rounded-full transition-all duration-300"
                style={{
                  width: `${(((step ?? 0) + 1) / TUTORIAL_STEPS.length) * 100}%`,
                }}
              />
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStep?.body}
            </p>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tutorial
              </button>
              <Button onClick={handleNext} className="gap-1.5">
                {(step ?? 0) < TUTORIAL_STEPS.length - 1 ? "Next" : "Finish"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card Modal ────────────────────────────────────────────────────────────────

function CardModal({
  card,
  users,
  tags,
  onClose,
  onUpdate,
  onDelete,
  onArchive,
  activeUser,
}: {
  card: TCard;
  users: TUser[];
  tags: TTag[];
  onClose: () => void;
  onUpdate: (updated: Partial<TCard>) => void;
  onDelete: () => void;
  onArchive: () => void;
  activeUser: TUser | null;
}) {
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description ?? "");
  const [editDueDate, setEditDueDate] = useState(card.dueDate ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [showChecklist, setShowChecklist] = useState(card.checklist.length > 0);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const cardTags = tags.filter((t) => card.tagIds.includes(t.id));

  function saveTitle() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== card.title) {
      onUpdate({ title: trimmed });
    }
  }

  function saveDesc() {
    const trimmed = editDesc.trim() || undefined;
    if (trimmed !== card.description) {
      onUpdate({ description: trimmed });
    }
  }

  function saveDueDate() {
    if (editDueDate !== (card.dueDate ?? "")) {
      onUpdate({ dueDate: editDueDate || undefined });
    }
  }

  function addChecklistItem() {
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;
    const newItem: TChecklistItem = {
      id: uid(),
      text: trimmed,
      checked: false,
    };
    onUpdate({ checklist: [...card.checklist, newItem] });
    setNewChecklistText("");
  }

  function toggleChecklistItem(itemId: string) {
    onUpdate({
      checklist: card.checklist.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      ),
    });
  }

  function deleteChecklistItem(itemId: string) {
    onUpdate({
      checklist: card.checklist.filter((item) => item.id !== itemId),
    });
  }

  function addComment() {
    const trimmed = newCommentText.trim();
    if (!trimmed || !activeUser) return;
    const comment: TComment = {
      id: uid(),
      text: trimmed,
      authorId: activeUser.id,
      createdAt: Date.now(),
    };
    onUpdate({ comments: [...card.comments, comment] });
    setNewCommentText("");
  }

  function deleteComment(commentId: string) {
    onUpdate({ comments: card.comments.filter((c) => c.id !== commentId) });
  }

  const checkedCount = card.checklist.filter((i) => i.checked).length;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-6 px-4 bg-foreground/20 backdrop-blur-sm overflow-y-auto"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
            <div className="flex flex-wrap gap-1.5">
              {cardTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    border: `1px solid ${tag.color}40`,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-5">
              {/* Title */}
              <div>
                <input
                  className="w-full font-display font-bold text-lg text-foreground bg-transparent border-none outline-none focus:bg-secondary/40 rounded-md px-1 -mx-1 py-0.5 transition-colors"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveTitle();
                    }
                  }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Description
                </span>
                <Textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onBlur={saveDesc}
                  placeholder="Add a description…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Assignee + Due date row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <UserCircle2 className="h-3.5 w-3.5" />
                    <span>Assignee</span>
                  </div>
                  <Select
                    value={card.assigneeId ?? "none"}
                    onValueChange={(v) =>
                      onUpdate({ assigneeId: v === "none" ? undefined : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Due date</span>
                  </div>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    onBlur={saveDueDate}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <TagIcon className="h-3.5 w-3.5" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = card.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          const newTagIds = active
                            ? card.tagIds.filter((t) => t !== tag.id)
                            : [...card.tagIds, tag.id];
                          onUpdate({ tagIds: newTagIds });
                        }}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-opacity"
                        style={{
                          backgroundColor: active
                            ? `${tag.color}25`
                            : `${tag.color}0d`,
                          color: active ? tag.color : `${tag.color}80`,
                          border: `1px solid ${active ? `${tag.color}50` : `${tag.color}25`}`,
                          opacity: active ? 1 : 0.6,
                        }}
                      >
                        {active && <Check className="h-2.5 w-2.5 mr-1" />}
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowChecklist((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>Checklist</span>
                  {card.checklist.length > 0 && (
                    <span className="text-[10px] text-primary font-semibold">
                      {checkedCount}/{card.checklist.length}
                    </span>
                  )}
                  {showChecklist ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  )}
                </button>
                {showChecklist && (
                  <div className="space-y-1.5 pl-1">
                    {card.checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 group"
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleChecklistItem(item.id)}
                          className="shrink-0"
                        />
                        <span
                          className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addChecklistItem();
                        }}
                        placeholder="Add item…"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={addChecklistItem}
                        disabled={!newChecklistText.trim()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Comments</span>
                  {card.comments.length > 0 && (
                    <span className="text-[10px] text-primary font-semibold">
                      {card.comments.length}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {card.comments.map((comment) => {
                    const author = users.find((u) => u.id === comment.authorId);
                    return (
                      <div key={comment.id} className="flex gap-2 group">
                        <div
                          className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                          title={author?.name}
                        >
                          {author?.initials ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-foreground">
                              {author?.name ?? "Unknown"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelative(comment.createdAt)}
                            </span>
                            {(activeUser?.id === comment.authorId ||
                              activeUser?.isAdmin) && (
                              <button
                                type="button"
                                onClick={() => deleteComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 ml-auto h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {activeUser ? (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                      {activeUser.initials}
                    </div>
                    <Input
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          addComment();
                        }
                      }}
                      placeholder="Add a comment…"
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={addComment}
                      disabled={!newCommentText.trim()}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Set an active user to comment
                  </p>
                )}
              </div>

              {/* History toggle */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Status history</span>
                  {showHistory ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  )}
                </button>
                {showHistory && (
                  <div className="space-y-1.5 pl-1">
                    <div className="text-xs text-muted-foreground py-1">
                      Card created — {formatDate(card.createdAt)}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer row: created + actions */}
              <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Created {formatDate(card.createdAt)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground hover:text-amber-600 text-xs gap-1"
                    onClick={() => {
                      onArchive();
                      onClose();
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive text-xs gap-1"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-foreground">
                Delete card?
              </h3>
              <p className="text-sm text-muted-foreground">
                This cannot be undone. Consider archiving instead.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-muted-foreground hover:text-amber-600"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onArchive();
                  onClose();
                }}
              >
                Archive instead
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onDelete();
                  onClose();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sortable Card ─────────────────────────────────────────────────────────────

function SortableCard({
  card,
  accentClass,
  users,
  tags,
  onOpen,
  disableDrag,
  isSelected,
  isSelectionMode,
  onToggleSelect,
}: {
  card: TCard;
  accentClass: string;
  users: TUser[];
  tags: TTag[];
  onOpen: () => void;
  disableDrag?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  showArchived?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled: disableDrag || isSelectionMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee = users.find((u) => u.id === card.assigneeId);
  const cardTags = tags.filter((t) => card.tagIds.includes(t.id));
  const checkedCount = card.checklist.filter((i) => i.checked).length;
  const hasChecklist = card.checklist.length > 0;
  const hasComments = card.comments.length > 0;
  const isOv = isOverdueStr(card.dueDate ?? "2099-01-01") && !!card.dueDate;
  const isSoon =
    isDueSoonStr(card.dueDate ?? "2099-01-01") && !!card.dueDate && !isOv;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`kanban-card rounded-lg border border-border bg-card opacity-40 border-l-4 ${accentClass} col-accent-border px-3 py-2.5 h-16`}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card relative rounded-lg border bg-card shadow-sm border-l-4 ${accentClass} col-accent-border ${isSelected ? "ring-2 ring-primary" : "border-border"} ${card.isArchived ? "opacity-60" : ""}`}
    >
      {/* Drag handle */}
      {!disableDrag && !isSelectionMode && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors touch-none h-5 w-5 flex items-center justify-center card-actions rounded"
          aria-label="Drag card"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Multi-select checkbox */}
      {isSelectionMode && (
        <div
          className="absolute top-2 right-2 z-10"
          role="presentation"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.stopPropagation();
              onToggleSelect?.(e as unknown as React.MouseEvent);
            }
          }}
        >
          <div
            className={`h-4 w-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isSelected ? "bg-primary border-primary" : "border-border bg-card hover:border-primary"}`}
          >
            {isSelected && (
              <Check className="h-2.5 w-2.5 text-primary-foreground" />
            )}
          </div>
        </div>
      )}

      {/* Archived badge */}
      {card.isArchived && (
        <div className="absolute top-1.5 left-1.5">
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
            Archived
          </Badge>
        </div>
      )}

      <button
        type="button"
        className="w-full text-left px-3 pt-2.5 pb-2"
        onClick={onOpen}
      >
        <p className="text-sm font-medium text-foreground leading-snug mb-1.5 pr-5">
          {card.title}
        </p>

        {cardTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {cardTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: `${tag.color}18`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Progress + meta row */}
        {hasChecklist && (
          <div className="mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
              <ListChecks className="h-2.5 w-2.5" />
              <span>
                {checkedCount}/{card.checklist.length}
              </span>
            </div>
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full col-accent-bar rounded-full transition-all"
                style={{
                  width: `${card.checklist.length ? (checkedCount / card.checklist.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5">
            {assignee ? (
              <div
                className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold shrink-0"
                title={assignee.name}
              >
                {assignee.initials}
              </div>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-dashed border-border shrink-0" />
            )}
            {hasComments && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MessageSquare className="h-2.5 w-2.5" />
                <span>{card.comments.length}</span>
              </div>
            )}
          </div>
          {card.dueDate && (
            <span
              className={`text-[10px] font-medium ${isOv ? "text-destructive" : isSoon ? "text-amber-600" : "text-muted-foreground"}`}
            >
              {isOv ? "⚠ " : ""}
              {formatDueDateStr(card.dueDate)}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────────────────────

function DroppableColumn({
  column,
  cards,
  colIdx,
  users,
  tags,
  onAddCard,
  onCardOpen,
  onRenameColumn,
  onDeleteColumn,
  onMoveMultiple,
  allColumns,
  isDraggingColumn,
  showArchived,
}: {
  column: TColumn;
  cards: TCard[];
  colIdx: number;
  users: TUser[];
  tags: TTag[];
  onAddCard: (columnId: string, title: string, desc?: string) => void;
  onCardOpen: (cardId: string) => void;
  onRenameColumn: (colId: string, name: string) => void;
  onDeleteColumn: (colId: string) => void;
  onMoveMultiple: (cardIds: string[], targetColId: string) => void;
  allColumns: TColumn[];
  isDraggingColumn: boolean;
  showArchived?: boolean;
}) {
  const accentClass = ACCENT_CLASSES[colIdx % ACCENT_CLASSES.length];
  const columnSortableId = `col-header-${column.id}`;

  const {
    attributes: colAttr,
    listeners: colListeners,
    setNodeRef: setColRef,
    transform: colTransform,
    transition: colTransition,
    isDragging: isColDragging,
  } = useSortable({ id: columnSortableId, data: { type: "column" } });

  const colStyle = {
    transform: CSS.Transform.toString(colTransform),
    transition: colTransition,
  };

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { type: "column" },
    disabled: isDraggingColumn,
  });

  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(column.name);
  const renameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const [addingCard, setAddingCard] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (addingCard) addRef.current?.focus();
  }, [addingCard]);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickText, setQuickText] = useState("");
  const quickRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (showQuickAdd) quickRef.current?.focus();
  }, [showQuickAdd]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDest, setDeleteDest] = useState<string>("none");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastIdx, setLastIdx] = useState<number | null>(null);
  const isSelectionMode = selectedIds.size > 0;

  function handleToggleSelect(
    cardId: string,
    idx: number,
    e: React.MouseEvent,
  ) {
    if (e.shiftKey && lastIdx !== null) {
      const min = Math.min(idx, lastIdx);
      const max = Math.max(idx, lastIdx);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = min; i <= max; i++) {
          if (cards[i]) next.add(cards[i].id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) next.delete(cardId);
        else next.add(cardId);
        return next;
      });
      setLastIdx(idx);
    }
  }

  function commitRename() {
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== column.name) onRenameColumn(column.id, trimmed);
    setRenaming(false);
  }

  function submitAddCard() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAddCard(column.id, trimmed, newDesc.trim() || undefined);
    setNewTitle("");
    setNewDesc("");
    setAddingCard(false);
  }

  function handleQuickAddSubmit() {
    const lines = quickText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      // Parse #tag and @user shortcuts (simple matching)
      let title = line;
      title = title
        .replace(/#\S+/g, "")
        .replace(/@\S+/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (title) onAddCard(column.id, title);
    }
    setQuickText("");
    setShowQuickAdd(false);
    if (lines.length)
      toast.success(
        `${lines.length} card${lines.length !== 1 ? "s" : ""} created`,
      );
  }

  const siblingsExcludeSelf = allColumns.filter((c) => c.id !== column.id);
  const visibleCards = showArchived
    ? cards
    : cards.filter((c) => !c.isArchived);

  const cardIds = visibleCards.map((c) => c.id);

  return (
    <>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteDialogOpen(false);
            setDeleteDest("none");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Delete column
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {visibleCards.length > 0 && siblingsExcludeSelf.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This column has{" "}
                  <span className="font-semibold text-foreground">
                    {visibleCards.length} card
                    {visibleCards.length !== 1 ? "s" : ""}
                  </span>
                  . Choose where to move them.
                </p>
                <Select value={deleteDest} onValueChange={setDeleteDest}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select column…" />
                  </SelectTrigger>
                  <SelectContent>
                    {siblingsExcludeSelf.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Delete "{column.name}"? This cannot be undone.
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={
                visibleCards.length > 0 &&
                siblingsExcludeSelf.length > 0 &&
                deleteDest === "none"
              }
              onClick={() => {
                if (visibleCards.length > 0 && deleteDest !== "none") {
                  onMoveMultiple(
                    visibleCards.map((c) => c.id),
                    deleteDest,
                  );
                }
                onDeleteColumn(column.id);
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div
        ref={(node) => {
          setColRef(node);
        }}
        style={{ animationDelay: `${colIdx * 60}ms`, ...colStyle }}
        className={`column-enter flex flex-col w-72 shrink-0 rounded-xl bg-card shadow-column overflow-hidden ${accentClass} ${isColDragging ? "opacity-50 scale-95" : ""}`}
      >
        <div className="col-accent-bar h-1 w-full shrink-0" />

        {/* Column header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          {renaming ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Input
                ref={renameRef}
                className="h-7 text-sm font-display font-semibold px-2 py-0"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
              />
              <button
                type="button"
                onClick={commitRename}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                {...colAttr}
                {...colListeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors touch-none shrink-0 -ml-1 h-6 w-5 flex items-center justify-center rounded"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenameVal(column.name);
                  setRenaming(true);
                }}
                className="flex-1 text-left font-display font-semibold text-sm text-foreground hover:col-accent-text truncate transition-colors"
              >
                {column.name}
              </button>
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 h-5 shrink-0"
              >
                {visibleCards.length}
              </Badge>
              <button
                type="button"
                onClick={() => setShowQuickAdd((v) => !v)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                title="Quick add"
              >
                <Zap className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameVal(column.name);
                      setRenaming(true);
                    }}
                  >
                    Rename column
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete column
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Quick Add */}
        {showQuickAdd && (
          <div className="mx-3 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">
                Quick Add
              </span>
            </div>
            <Textarea
              ref={quickRef}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder={"One card per line\nInspect part batch #Active"}
              rows={3}
              className="text-xs resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs px-3 gap-1"
                onClick={handleQuickAddSubmit}
                disabled={!quickText.trim()}
              >
                <Zap className="h-3 w-3" />
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-3"
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Cards */}
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            ref={setDropRef}
            className={`flex-1 overflow-y-auto px-3 pb-2 min-h-[80px] max-h-[calc(100vh-300px)] transition-colors rounded-b-md ${isOver && !isDraggingColumn ? "column-drag-over" : ""} ${accentClass}`}
          >
            {visibleCards.length === 0 && !addingCard && (
              <div
                className={`flex flex-col items-center justify-center py-8 col-accent-bg-soft rounded-lg border border-dashed border-border ${isOver ? "border-solid" : ""}`}
              >
                <p className="text-xs text-muted-foreground">
                  {isOver ? "Drop card here" : "No cards yet"}
                </p>
              </div>
            )}
            <div className="space-y-2">
              {visibleCards.map((card, idx) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  accentClass={accentClass}
                  users={users}
                  tags={tags}
                  onOpen={() => onCardOpen(card.id)}
                  disableDrag={isDraggingColumn}
                  isSelected={selectedIds.has(card.id)}
                  isSelectionMode={isSelectionMode}
                  onToggleSelect={(e) => handleToggleSelect(card.id, idx, e)}
                  showArchived={showArchived}
                />
              ))}
            </div>

            {/* Inline add card */}
            {addingCard && (
              <div className="rounded-lg bg-card border border-border p-3 shadow-xs mt-2">
                <Input
                  ref={addRef}
                  className="mb-2 text-sm"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setAddingCard(false);
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitAddCard();
                    }
                  }}
                  placeholder="Card title"
                />
                <Textarea
                  className="mb-2 text-sm resize-none"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setAddingCard(false);
                  }}
                  placeholder="Description (optional)"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={submitAddCard}
                    disabled={!newTitle.trim()}
                  >
                    Add card
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-3"
                    onClick={() => setAddingCard(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SortableContext>

        {/* Multi-select toolbar */}
        {isSelectionMode && (
          <div className="mx-3 mb-2 mt-1 rounded-lg bg-primary/10 border border-primary/25 px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-primary shrink-0">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />
            {siblingsExcludeSelf.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    Move to…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {siblingsExcludeSelf.map((col) => (
                    <DropdownMenuItem
                      key={col.id}
                      onClick={() => {
                        onMoveMultiple([...selectedIds], col.id);
                        setSelectedIds(new Set());
                        setLastIdx(null);
                      }}
                    >
                      {col.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground"
              onClick={() => {
                setSelectedIds(new Set());
                setLastIdx(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Add card footer */}
        <div className="px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setAddingCard(true)}
            className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg px-2 py-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </button>
        </div>
      </div>
    </>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBarT({
  users,
  tags,
  filters,
  onChange,
}: {
  users: TUser[];
  tags: TTag[];
  filters: {
    assigneeId: string | null;
    tagId: string | null;
    text: string;
    unassignedOnly: boolean;
    showArchived: boolean;
  };
  onChange: (f: typeof filters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-border bg-card/50">
      <Input
        value={filters.text}
        onChange={(e) => onChange({ ...filters, text: e.target.value })}
        placeholder="Search…"
        className="h-8 text-xs w-40"
      />
      <Select
        value={filters.assigneeId ?? "all"}
        onValueChange={(v) =>
          onChange({
            ...filters,
            assigneeId: v === "all" ? null : v,
            unassignedOnly: false,
          })
        }
      >
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="All assignees" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assignees</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.tagId ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, tagId: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...filters,
            unassignedOnly: !filters.unassignedOnly,
            assigneeId: null,
          })
        }
        className={`h-8 px-3 text-xs rounded-md border transition-colors ${filters.unassignedOnly ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
      >
        Unassigned
      </button>
      <button
        type="button"
        onClick={() =>
          onChange({ ...filters, showArchived: !filters.showArchived })
        }
        className={`h-8 px-3 text-xs rounded-md border transition-colors ${filters.showArchived ? "bg-amber-500/20 text-amber-700 border-amber-400/40" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
      >
        Archived
      </button>
      {(filters.assigneeId ||
        filters.tagId ||
        filters.text ||
        filters.unassignedOnly ||
        filters.showArchived) && (
        <button
          type="button"
          onClick={() =>
            onChange({
              assigneeId: null,
              tagId: null,
              text: "",
              unassignedOnly: false,
              showArchived: false,
            })
          }
          className="h-8 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex items-center gap-1"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTabT({
  users,
  tags,
  activeUser,
  onSetActive,
  onAddUser,
  onAddTag,
  onDeleteTag,
}: {
  users: TUser[];
  tags: TTag[];
  activeUser: TUser | null;
  onSetActive: (u: TUser) => void;
  onAddUser: (name: string) => void;
  onAddTag: (name: string, color: string) => void;
  onDeleteTag: (tagId: string) => void;
}) {
  const [newUserName, setNewUserName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Users */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-foreground">
            Team Members
          </h2>
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {user.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.isMasterAdmin
                      ? "Master Admin"
                      : user.isAdmin
                        ? "Admin"
                        : "Member"}
                  </p>
                </div>
                {activeUser?.id === user.id ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    Active
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onSetActive(user)}
                  >
                    Set active
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newUserName.trim()) {
                  onAddUser(newUserName.trim());
                  setNewUserName("");
                }
              }}
              placeholder="Add team member…"
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              className="h-8"
              disabled={!newUserName.trim()}
              onClick={() => {
                if (newUserName.trim()) {
                  onAddUser(newUserName.trim());
                  setNewUserName("");
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-foreground">
            Tags
          </h2>
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm text-foreground flex-1">
                  {tag.name}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteTag(tag.id)}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="h-8 w-10 rounded border border-border cursor-pointer"
            />
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTagName.trim()) {
                  onAddTag(newTagName.trim(), newTagColor);
                  setNewTagName("");
                }
              }}
              placeholder="Tag name…"
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              className="h-8"
              disabled={!newTagName.trim()}
              onClick={() => {
                if (newTagName.trim()) {
                  onAddTag(newTagName.trim(), newTagColor);
                  setNewTagName("");
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTabT({
  activities,
  users,
}: { activities: TActivity[]; users: TUser[] }) {
  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto p-6 space-y-3">
        <h2 className="font-display font-bold text-base text-foreground mb-4">
          Activity Log
        </h2>
        {activities.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No activity yet
          </div>
        ) : (
          [...activities].reverse().map((a) => {
            const user = users.find((u) => u.id === a.userId);
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
              >
                <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                  {user?.initials ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelative(a.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTabT({
  columns,
  cards,
  users,
  tags,
}: {
  columns: TColumn[];
  cards: TCard[];
  users: TUser[];
  tags: TTag[];
}) {
  const activeCards = cards.filter((c) => !c.isArchived);
  const overdueCards = activeCards.filter(
    (c) => c.dueDate && isOverdueStr(c.dueDate),
  );

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total Cards",
              value: activeCards.length,
              color: "text-primary",
            },
            {
              label: "Overdue",
              value: overdueCards.length,
              color: "text-destructive",
            },
            {
              label: "Team Members",
              value: users.length,
              color: "text-primary",
            },
            { label: "Columns", value: columns.length, color: "text-primary" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 text-center"
            >
              <p className={`font-display font-bold text-2xl ${s.color}`}>
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Cards per column */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-foreground">
            Cards by Column
          </h2>
          {columns.map((col, idx) => {
            const count = activeCards.filter(
              (c) => c.columnId === col.id,
            ).length;
            const pct = activeCards.length
              ? (count / activeCards.length) * 100
              : 0;
            const accentClass = ACCENT_CLASSES[idx % ACCENT_CLASSES.length];
            return (
              <div key={col.id} className="flex items-center gap-3">
                <span className="text-sm text-foreground w-28 shrink-0 truncate">
                  {col.name}
                </span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full col-accent-bar rounded-full transition-all ${accentClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Cards per assignee */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-foreground">
            Cards by Assignee
          </h2>
          {users.map((user) => {
            const count = activeCards.filter(
              (c) => c.assigneeId === user.id,
            ).length;
            return (
              <div key={user.id} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                  {user.initials}
                </div>
                <span className="text-sm text-foreground w-24 shrink-0 truncate">
                  {user.name}
                </span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full col-accent-0 col-accent-bar rounded-full transition-all"
                    style={{
                      width: activeCards.length
                        ? `${(count / activeCards.length) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-dashed border-border shrink-0" />
            <span className="text-sm text-muted-foreground w-24 shrink-0">
              Unassigned
            </span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full col-accent-3 col-accent-bar rounded-full transition-all"
                style={{
                  width: activeCards.length
                    ? `${(activeCards.filter((c) => !c.assigneeId).length / activeCards.length) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
              {activeCards.filter((c) => !c.assigneeId).length}
            </span>
          </div>
        </div>

        {/* Overdue cards */}
        {overdueCards.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display font-bold text-base text-destructive">
              Overdue Cards
            </h2>
            <div className="space-y-2">
              {overdueCards.map((card) => {
                const col = columns.find((c) => c.id === card.columnId);
                const assignee = users.find((u) => u.id === card.assigneeId);
                return (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {card.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {col?.name} · {assignee?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <span className="text-xs text-destructive font-medium shrink-0">
                      {formatDueDateStr(card.dueDate!)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tag usage */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-foreground">
            Tag Usage
          </h2>
          {tags.map((tag) => {
            const count = activeCards.filter((c) =>
              c.tagIds.includes(tag.id),
            ).length;
            return (
              <div key={tag.id} className="flex items-center gap-3">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm text-foreground w-36 shrink-0 truncate">
                  {tag.name}
                </span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: activeCards.length
                        ? `${(count / activeCards.length) * 100}%`
                        : "0%",
                      backgroundColor: tag.color,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Undo/Redo ─────────────────────────────────────────────────────────────────

interface UndoEntry {
  label: string;
  undo: () => void;
  redo: () => void;
}

function useUndoRedo() {
  const [stack, setStack] = useState<UndoEntry[]>([]);
  const [pointer, setPointer] = useState(-1);

  function push(entry: UndoEntry) {
    setStack((prev) => {
      const next = prev.slice(0, pointer + 1);
      return [...next, entry].slice(-50);
    });
    setPointer((p) => Math.min(p + 1, 49));
  }

  function undo() {
    if (pointer < 0) return;
    stack[pointer].undo();
    setPointer((p) => p - 1);
  }

  function redo() {
    if (pointer >= stack.length - 1) return;
    const next = stack[pointer + 1];
    next.redo();
    setPointer((p) => p + 1);
  }

  const canUndo = pointer >= 0;
  const canRedo = pointer < stack.length - 1;

  return { push, undo, redo, canUndo, canRedo };
}

// ── Main TutorialApp ──────────────────────────────────────────────────────────

export default function TutorialApp() {
  // ── Core state ────────────────────────────────────────────────────────────
  const [columns, setColumns] = useState<TColumn[]>(SEED_COLUMNS);
  const [cards, setCards] = useState<TCard[]>(SEED_CARDS);
  const [users, setUsers] = useState<TUser[]>(SEED_USERS);
  const [tags, setTags] = useState<TTag[]>(SEED_TAGS);
  const [activities, setActivities] = useState<TActivity[]>(SEED_ACTIVITY);
  const [activeUser, setActiveUser] = useState<TUser>(SEED_USERS[0]);
  const [activeTab, setActiveTab] = useState<TabId>("board");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  // ── Tutorial overlay ──────────────────────────────────────────────────────
  const [overlayOpen, setOverlayOpen] = useState(() => {
    return !sessionStorage.getItem("tutorial_overlay_seen");
  });
  const [overlayForced, setOverlayForced] = useState(false);

  function openTutorial() {
    setOverlayForced(true);
    setOverlayOpen(true);
  }

  function closeOverlay() {
    setOverlayOpen(false);
    setOverlayForced(false);
  }

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    assigneeId: null as string | null,
    tagId: null as string | null,
    text: "",
    unassignedOnly: false,
    showArchived: false,
  });

  // ── Undo/Redo ─────────────────────────────────────────────────────────────
  const { push: pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (activeTab !== "board") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (ctrl && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, undo, redo]);

  // ── Activity helper ───────────────────────────────────────────────────────
  function logActivity(text: string, userId?: string) {
    setActivities((prev) => [
      ...prev,
      {
        id: uid(),
        text,
        userId: userId ?? activeUser.id,
        timestamp: Date.now(),
      },
    ]);
  }

  // ── Card operations ───────────────────────────────────────────────────────
  function addCard(columnId: string, title: string, desc?: string) {
    const newCard: TCard = {
      id: uid(),
      title,
      description: desc,
      columnId,
      tagIds: [],
      createdAt: Date.now(),
      checklist: [],
      comments: [],
    };
    setCards((prev) => [...prev, newCard]);
    logActivity(`${activeUser.name} created "${title}"`);
    const prevCards = cards;
    pushUndo({
      label: "Add card",
      undo: () => setCards(prevCards),
      redo: () => setCards((p) => [...p, newCard]),
    });
  }

  function updateCard(cardId: string, patch: Partial<TCard>) {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
    );
  }

  function deleteCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    const prev = cards;
    setCards((p) => p.filter((c) => c.id !== cardId));
    logActivity(`${activeUser.name} deleted "${card?.title ?? cardId}"`);
    pushUndo({
      label: "Delete card",
      undo: () => setCards(prev),
      redo: () => setCards((p) => p.filter((c) => c.id !== cardId)),
    });
  }

  function archiveCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isArchived: true } : c)),
    );
    logActivity(`${activeUser.name} archived "${card?.title ?? cardId}"`);
    pushUndo({
      label: "Archive card",
      undo: () =>
        setCards((p) =>
          p.map((c) => (c.id === cardId ? { ...c, isArchived: false } : c)),
        ),
      redo: () =>
        setCards((p) =>
          p.map((c) => (c.id === cardId ? { ...c, isArchived: true } : c)),
        ),
    });
  }

  function moveCardTo(cardId: string, targetColId: string) {
    const card = cards.find((c) => c.id === cardId);
    const prevColId = card?.columnId;
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, columnId: targetColId } : c)),
    );
    const targetCol = columns.find((c) => c.id === targetColId);
    logActivity(
      `${activeUser.name} moved "${card?.title}" to ${targetCol?.name}`,
    );
    pushUndo({
      label: "Move card",
      undo: () =>
        setCards((p) =>
          p.map((c) =>
            c.id === cardId ? { ...c, columnId: prevColId ?? c.columnId } : c,
          ),
        ),
      redo: () =>
        setCards((p) =>
          p.map((c) => (c.id === cardId ? { ...c, columnId: targetColId } : c)),
        ),
    });
  }

  function moveMultipleCards(cardIds: string[], targetColId: string) {
    const prevCards = cards;
    setCards((prev) =>
      prev.map((c) =>
        cardIds.includes(c.id) ? { ...c, columnId: targetColId } : c,
      ),
    );
    const targetCol = columns.find((c) => c.id === targetColId);
    logActivity(
      `${activeUser.name} moved ${cardIds.length} cards to ${targetCol?.name}`,
    );
    pushUndo({
      label: "Move cards",
      undo: () => setCards(prevCards),
      redo: () =>
        setCards((p) =>
          p.map((c) =>
            cardIds.includes(c.id) ? { ...c, columnId: targetColId } : c,
          ),
        ),
    });
  }

  // ── Column operations ─────────────────────────────────────────────────────
  function addColumn(name: string) {
    const newCol: TColumn = { id: uid(), name, order: columns.length };
    setColumns((prev) => [...prev, newCol]);
    logActivity(`${activeUser.name} created column "${name}"`);
  }

  function renameColumn(colId: string, name: string) {
    setColumns((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, name } : c)),
    );
    logActivity(`${activeUser.name} renamed column to "${name}"`);
  }

  function deleteColumn(colId: string) {
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setCards((prev) => prev.filter((c) => c.columnId !== colId));
    logActivity(`${activeUser.name} deleted a column`);
  }

  // ── User operations ───────────────────────────────────────────────────────
  function addUser(name: string) {
    const newUser: TUser = {
      id: uid(),
      name,
      initials: getInitials(name),
    };
    setUsers((prev) => [...prev, newUser]);
    logActivity(`${activeUser.name} added team member "${name}"`);
  }

  // ── Tag operations ────────────────────────────────────────────────────────
  function addTag(name: string, color: string) {
    setTags((prev) => [...prev, { id: uid(), name, color }]);
  }

  function deleteTag(tagId: string) {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setCards((prev) =>
      prev.map((c) => ({ ...c, tagIds: c.tagIds.filter((t) => t !== tagId) })),
    );
  }

  // ── Drag and Drop ─────────────────────────────────────────────────────────
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [localColumnOrder, setLocalColumnOrder] = useState<TColumn[] | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const effectiveColumns = localColumnOrder ?? columns;
  const columnSortableIds = effectiveColumns.map((c) => `col-header-${c.id}`);

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string;
    if (id.startsWith("col-header-")) {
      setDraggingColumnId(id);
      setLocalColumnOrder(columns);
    } else {
      setDraggingCardId(id);
    }
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith("col-header-")) {
      if (!overId.startsWith("col-header-") || !localColumnOrder) return;
      const aIdx = localColumnOrder.findIndex(
        (c) => `col-header-${c.id}` === activeId,
      );
      const oIdx = localColumnOrder.findIndex(
        (c) => `col-header-${c.id}` === overId,
      );
      if (aIdx === -1 || oIdx === -1 || aIdx === oIdx) return;
      setLocalColumnOrder((prev) =>
        prev ? arrayMove(prev, aIdx, oIdx) : prev,
      );
      return;
    }

    // Card dragged over another column
    const targetColId = overId.startsWith("col-")
      ? overId.replace("col-", "")
      : null;

    if (targetColId) {
      const card = cards.find((c) => c.id === activeId);
      if (card && card.columnId !== targetColId) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, columnId: targetColId } : c,
          ),
        );
      }
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeId = active.id as string;

    if (activeId.startsWith("col-header-")) {
      setDraggingColumnId(null);
      if (localColumnOrder) {
        setColumns(localColumnOrder.map((c, i) => ({ ...c, order: i })));
        setLocalColumnOrder(null);
        logActivity(`${activeUser.name} reordered columns`);
      }
      return;
    }

    setDraggingCardId(null);

    if (!over) return;
    const overId = over.id as string;
    const targetColId = overId.startsWith("col-")
      ? overId.replace("col-", "")
      : null;

    if (targetColId) {
      const card = cards.find((c) => c.id === activeId);
      if (card && card.columnId !== targetColId) {
        moveCardTo(activeId, targetColId);
      }
    } else {
      // Dropped on another card
      const targetCard = cards.find((c) => c.id === overId);
      if (targetCard) {
        const dragCard = cards.find((c) => c.id === activeId);
        if (dragCard && dragCard.columnId !== targetCard.columnId) {
          moveCardTo(activeId, targetCard.columnId);
        }
      }
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  function applyFilters(columnCards: TCard[]): TCard[] {
    return columnCards.filter((card) => {
      if (filters.showArchived) {
        if (!card.isArchived) return false;
      } else {
        if (card.isArchived) return false;
      }
      if (filters.text) {
        const q = filters.text.toLowerCase();
        if (
          !card.title.toLowerCase().includes(q) &&
          !card.description?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.unassignedOnly && card.assigneeId) return false;
      if (filters.assigneeId && card.assigneeId !== filters.assigneeId)
        return false;
      if (filters.tagId && !card.tagIds.includes(filters.tagId)) return false;
      return true;
    });
  }

  const selectedCard = selectedCardId
    ? (cards.find((c) => c.id === selectedCardId) ?? null)
    : null;
  const draggingCard = draggingCardId
    ? (cards.find((c) => c.id === draggingCardId) ?? null)
    : null;
  const draggingCardColIdx = draggingCard
    ? effectiveColumns.findIndex((c) => c.id === draggingCard.columnId)
    : 0;
  const draggingAccentClass = `col-accent-border ${ACCENT_CLASSES[draggingCardColIdx % ACCENT_CLASSES.length]}`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Tutorial overlay */}
      {overlayOpen && (
        <TutorialOverlay onClose={closeOverlay} forceOpen={overlayForced} />
      )}

      {/* Card modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          users={users}
          tags={tags}
          activeUser={activeUser}
          onClose={() => setSelectedCardId(null)}
          onUpdate={(patch) => updateCard(selectedCard.id, patch)}
          onDelete={() => {
            deleteCard(selectedCard.id);
            setSelectedCardId(null);
          }}
          onArchive={() => {
            archiveCard(selectedCard.id);
            setSelectedCardId(null);
          }}
        />
      )}

      {/* Amber banner */}
      <div className="flex items-center justify-center gap-3 px-6 py-2 bg-amber-500/10 border-b border-amber-500/25">
        <p className="text-xs text-amber-700 font-medium text-center">
          This is an interactive portfolio demo of Terry Brutus's Kanban
          workflow tool. All actions are fully functional — changes reset when
          you leave.
        </p>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-6 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
        {/* Logo + Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-7 w-7 rounded-lg col-accent-0 col-accent-bar flex items-center justify-center">
            <Kanban className="h-4 w-4 text-card" />
          </div>
          <h1 className="font-display font-bold text-lg text-foreground tracking-tight">
            Kanban
          </h1>
        </div>

        <div className="shrink-0 text-xs font-medium text-muted-foreground border border-border rounded-md px-2.5 py-1 bg-secondary/50">
          Toyota Production Workflow
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Tab bar */}
        <nav className="flex items-center gap-1">
          {(["board", "users", "activity", "dashboard"] as TabId[]).map(
            (tab) => {
              const icons = {
                board: LayoutDashboard,
                users: Users,
                activity: Clock,
                dashboard: BarChart2,
              };
              const labels = {
                board: "Board",
                users: "Users",
                activity: "Activity",
                dashboard: "Dashboard",
              };
              const Icon = icons[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {labels[tab]}
                </button>
              );
            },
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Tutorial button */}
          <button
            type="button"
            onClick={openTutorial}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="Open tutorial"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>

          {/* Undo/Redo */}
          {activeTab === "board" && (
            <>
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Redo</span>
              </button>
            </>
          )}

          {/* Active user switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium hover:bg-primary/15 transition-colors"
              >
                <div className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold">
                  {activeUser.initials[0]}
                </div>
                {activeUser.name}
                {activeUser.isMasterAdmin && (
                  <Crown className="h-2.5 w-2.5 text-amber-500" />
                )}
                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {users.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setActiveUser(user)}
                  className="flex items-center gap-2"
                >
                  <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {user.initials}
                  </div>
                  <span className="flex-1 truncate">{user.name}</span>
                  {user.isMasterAdmin && (
                    <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  {activeUser.id === user.id && (
                    <span className="text-[9px] text-primary font-semibold shrink-0">
                      Active
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <p className="text-[10px] text-muted-foreground">
                  No PIN needed in tutorial mode
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "board" && (
          <>
            <FilterBarT
              users={users}
              tags={tags}
              filters={filters}
              onChange={setFilters}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={columnSortableIds}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex gap-5 p-6 overflow-x-auto kanban-board flex-1 items-start">
                  {effectiveColumns.map((column, idx) => {
                    const colCards = cards.filter(
                      (c) => c.columnId === column.id,
                    );
                    const filtered = applyFilters(colCards);
                    return (
                      <DroppableColumn
                        key={column.id}
                        column={column}
                        cards={filtered}
                        colIdx={idx}
                        users={users}
                        tags={tags}
                        onAddCard={addCard}
                        onCardOpen={(cardId) => setSelectedCardId(cardId)}
                        onRenameColumn={renameColumn}
                        onDeleteColumn={deleteColumn}
                        onMoveMultiple={moveMultipleCards}
                        allColumns={effectiveColumns}
                        isDraggingColumn={draggingColumnId !== null}
                        showArchived={filters.showArchived}
                      />
                    );
                  })}

                  {/* Add column */}
                  <div className="shrink-0 w-72">
                    {addingColumn ? (
                      <div className="rounded-xl bg-card shadow-column p-4 space-y-3">
                        <p className="text-sm font-display font-semibold text-foreground">
                          New Column
                        </p>
                        <Input
                          autoFocus
                          value={newColumnName}
                          onChange={(e) => setNewColumnName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (newColumnName.trim()) {
                                addColumn(newColumnName.trim());
                                setNewColumnName("");
                                setAddingColumn(false);
                              }
                            }
                            if (e.key === "Escape") {
                              setAddingColumn(false);
                              setNewColumnName("");
                            }
                          }}
                          placeholder="Column name"
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs px-4"
                            onClick={() => {
                              if (newColumnName.trim()) {
                                addColumn(newColumnName.trim());
                                setNewColumnName("");
                                setAddingColumn(false);
                              }
                            }}
                            disabled={!newColumnName.trim()}
                          >
                            Add column
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs px-3"
                            onClick={() => {
                              setAddingColumn(false);
                              setNewColumnName("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-12 text-sm text-muted-foreground border-dashed border-2 hover:border-solid hover:text-foreground hover:bg-secondary gap-2 transition-all"
                        onClick={() => setAddingColumn(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Add column
                      </Button>
                    )}
                  </div>
                </div>
              </SortableContext>

              {/* Drag overlay */}
              <DragOverlay dropAnimation={null}>
                {draggingCard ? (
                  <div
                    className={`kanban-card rounded-lg border border-border bg-card shadow-lg border-l-4 ${draggingAccentClass} col-accent-border px-3 py-2.5 w-72 opacity-95`}
                  >
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {draggingCard.title}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}

        {activeTab === "users" && (
          <UsersTabT
            users={users}
            tags={tags}
            activeUser={activeUser}
            onSetActive={setActiveUser}
            onAddUser={addUser}
            onAddTag={addTag}
            onDeleteTag={deleteTag}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTabT activities={activities} users={users} />
        )}

        {activeTab === "dashboard" && (
          <DashboardTabT
            columns={columns}
            cards={cards}
            users={users}
            tags={tags}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground border-t border-border">
        <span>© {new Date().getFullYear()}. Created by Terry Brutus</span>
      </footer>
    </div>
  );
}
