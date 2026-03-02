import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  Check,
  Crown,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  Pencil,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useChangeUserPin,
  useCreateUser,
  useDeleteUser,
  useDemoteUser,
  useGetAccessKey,
  usePromoteUser,
  useRenameUser,
  useResetMasterAdminPinWithSecurityAnswer,
  useResetUserPin,
  useSetAccessKey,
  useSetMasterAdminSecurityQuestion,
  useSetupMasterAdmin,
  useUsers,
  useVerifyPin,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

// ── PIN hashing ──────────────────────────────────────────────────────────────
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── PinInput helper ───────────────────────────────────────────────────────────
interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}

function PinInput({
  value,
  onChange,
  onKeyDown,
  disabled,
  placeholder = "••••",
  autoFocus,
  id,
}: PinInputProps) {
  return (
    <Input
      id={id}
      type="password"
      inputMode="numeric"
      maxLength={4}
      pattern="[0-9]*"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
        onChange(val);
      }}
      onKeyDown={onKeyDown}
      disabled={disabled}
      className="h-8 text-sm w-24 text-center tracking-widest font-mono"
      autoFocus={autoFocus}
    />
  );
}

// ── Admin-reset by role (replaces AdminResetForm) ─────────────────────────────
interface AdminResetByRoleProps {
  user: User;
  activeUser: User | null;
  onSuccess: (newPin: string) => void;
  onCancel: () => void;
}

function AdminResetByRole({
  user,
  activeUser,
  onSuccess,
  onCancel,
}: AdminResetByRoleProps) {
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync: resetUserPin, isPending } = useResetUserPin();

  // No admin active — show informative message
  if (!activeUser || (!activeUser.isAdmin && !activeUser.isMasterAdmin)) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span>Admin required</span>
        </div>
        <p className="text-xs text-muted-foreground">
          An admin must be set as active to reset PINs. Ask your admin to set
          themselves as active first.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }

  async function handleReset() {
    if (newPin.length !== 4) {
      setError("New PIN must be 4 digits");
      return;
    }
    if (!activeUser) return;
    setError("");
    try {
      const newHash = await hashPin(newPin);
      await resetUserPin({
        userId: user.id,
        actorUserId: activeUser.id,
        newPinHash: newHash,
      });
      toast.success("PIN reset successfully");
      onSuccess(newPin);
    } catch {
      setError("Reset failed — make sure you have admin privileges");
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>Admin PIN reset (as {activeUser.name})</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          New PIN
        </span>
        <PinInput
          value={newPin}
          onChange={(v) => {
            setNewPin(v);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleReset();
            if (e.key === "Escape") onCancel();
          }}
          disabled={isPending}
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-8 text-xs px-3 bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleReset}
          disabled={newPin.length !== 4 || isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Reset PIN"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
interface DeleteConfirmProps {
  user: User;
  activeUser: User | null;
  onSetActive: (user: User | null) => void;
  onCancel: () => void;
}

function DeleteConfirm({
  user,
  activeUser,
  onSetActive,
  onCancel,
}: DeleteConfirmProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const { mutateAsync: verifyPin, isPending: isVerifying } = useVerifyPin();
  const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();

  const isPending = isVerifying || isDeleting;

  // Master admin cannot be deleted
  if (user.isMasterAdmin) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Master admin cannot be deleted</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
        >
          Close
        </Button>
      </div>
    );
  }

  // Admin can delete non-master users, or user can delete themselves
  const canAdminDelete =
    activeUser &&
    (activeUser.isAdmin || activeUser.isMasterAdmin) &&
    activeUser.id !== user.id;
  const canSelfDelete = activeUser?.id === user.id;

  if (!canAdminDelete && !canSelfDelete) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>You can only delete your own account</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }

  async function handleConfirm() {
    if (!activeUser) return;

    // If admin is deleting someone else, no PIN needed (they're already verified as active)
    if (canAdminDelete) {
      try {
        await deleteUser({ userId: user.id, actorUserId: activeUser.id });
        toast.success(`User "${user.name}" removed`);
        onCancel();
      } catch {
        toast.error("Failed to delete user");
      }
      return;
    }

    // Self-delete requires PIN verification
    if (pin.length !== 4) {
      setError("Enter your 4-digit PIN");
      return;
    }
    setError("");
    try {
      const pinHash = await hashPin(pin);
      const valid = await verifyPin({ userId: user.id, pinHash });
      if (!valid) {
        setError("Incorrect PIN");
        return;
      }
      await deleteUser({ userId: user.id, actorUserId: activeUser.id });
      if (activeUser?.id === user.id) {
        onSetActive(null);
      }
      toast.success(`User "${user.name}" removed`);
    } catch {
      toast.error("Failed to delete user");
    }
  }

  if (showForgot) {
    return (
      <AdminResetByRole
        user={user}
        activeUser={activeUser}
        onSuccess={(newPin) => {
          setPin(newPin);
          setShowForgot(false);
        }}
        onCancel={() => setShowForgot(false)}
      />
    );
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {canAdminDelete ? (
          <span>Delete {user.name}? This cannot be undone.</span>
        ) : (
          <span>Enter your PIN to confirm deletion</span>
        )}
      </div>
      {canSelfDelete && !canAdminDelete && (
        <>
          <div className="flex items-center gap-2">
            <PinInput
              value={pin}
              onChange={(v) => {
                setPin(v);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
                if (e.key === "Escape") onCancel();
              }}
              disabled={isPending}
              autoFocus
            />
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs px-3"
              onClick={handleConfirm}
              disabled={pin.length !== 4 || isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-3"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            onClick={() => setShowForgot(true)}
          >
            Forgot PIN? Reset with admin
          </button>
        </>
      )}
      {canAdminDelete && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs px-3"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Delete"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs px-3"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Set Active confirmation dialog ────────────────────────────────────────────
interface SetActiveConfirmProps {
  user: User;
  activeUser: User | null;
  onSuccess: (user: User) => void;
  onCancel: () => void;
  masterAdmin?: User | null;
}

function SetActiveConfirm({
  user,
  activeUser,
  onSuccess,
  onCancel,
  masterAdmin,
}: SetActiveConfirmProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const { mutateAsync: verifyPin, isPending } = useVerifyPin();

  async function handleConfirm(pinOverride?: string) {
    const usePin = pinOverride ?? pin;
    if (usePin.length !== 4) {
      setError("Enter your 4-digit PIN");
      return;
    }
    setError("");
    try {
      const pinHash = await hashPin(usePin);
      const valid = await verifyPin({ userId: user.id, pinHash });
      if (!valid) {
        setError("Incorrect PIN");
        return;
      }
      onSuccess(user);
      toast.success(`Now active as "${user.name}"`);
    } catch {
      toast.error("Verification failed");
    }
  }

  if (showForgot) {
    return (
      <AdminResetByRole
        user={user}
        activeUser={activeUser}
        onSuccess={(newPin) => {
          setPin(newPin);
          setShowForgot(false);
          handleConfirm(newPin);
        }}
        onCancel={() => setShowForgot(false)}
      />
    );
  }

  if (showSecurityQuestion && masterAdmin && user.isMasterAdmin) {
    return (
      <MasterAdminForgotPin
        masterAdmin={masterAdmin}
        onSuccess={(newPin) => {
          setPin(newPin);
          setShowSecurityQuestion(false);
          handleConfirm(newPin);
        }}
        onCancel={() => setShowSecurityQuestion(false)}
      />
    );
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>Enter your PIN to set as active user</span>
      </div>
      <div className="flex items-center gap-2">
        <PinInput
          value={pin}
          onChange={(v) => {
            setPin(v);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onCancel();
          }}
          disabled={isPending}
          autoFocus
        />
        <Button
          size="sm"
          className="h-8 text-xs px-3"
          onClick={() => handleConfirm()}
          disabled={pin.length !== 4 || isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Confirm"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {user.isMasterAdmin && masterAdmin?.securityQuestion ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          onClick={() => setShowSecurityQuestion(true)}
        >
          Forgot PIN? Use security question
        </button>
      ) : (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          onClick={() => setShowForgot(true)}
        >
          Forgot PIN? Reset with admin
        </button>
      )}
    </div>
  );
}

// ── Change PIN form ───────────────────────────────────────────────────────────
interface ChangePinFormProps {
  user: User;
  onDone: () => void;
}

function ChangePinForm({ user, onDone }: ChangePinFormProps) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync: changeUserPin, isPending } = useChangeUserPin();

  async function handleChange() {
    if (oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      setError("All PINs must be 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs don't match");
      return;
    }
    setError("");
    try {
      const oldHash = await hashPin(oldPin);
      const newHash = await hashPin(newPin);
      await changeUserPin({
        userId: user.id,
        oldPinHash: oldHash,
        newPinHash: newHash,
      });
      toast.success("PIN changed successfully");
      onDone();
    } catch {
      setError("Old PIN is incorrect");
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-secondary border border-border space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Change PIN</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">
            Current PIN
          </span>
          <PinInput
            value={oldPin}
            onChange={(v) => {
              setOldPin(v);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onDone();
            }}
            disabled={isPending}
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">
            New PIN
          </span>
          <PinInput
            value={newPin}
            onChange={(v) => {
              setNewPin(v);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onDone();
            }}
            disabled={isPending}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">
            Confirm PIN
          </span>
          <PinInput
            value={confirmPin}
            onChange={(v) => {
              setConfirmPin(v);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleChange();
              if (e.key === "Escape") onDone();
            }}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-8 text-xs px-3"
          onClick={handleChange}
          disabled={
            oldPin.length !== 4 ||
            newPin.length !== 4 ||
            confirmPin.length !== 4 ||
            isPending
          }
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Update PIN"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onDone}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Master Admin Forgot PIN (security question) ───────────────────────────────
interface MasterAdminForgotPinProps {
  masterAdmin: User;
  onSuccess: (newPin: string) => void;
  onCancel: () => void;
}

function MasterAdminForgotPin({
  masterAdmin,
  onSuccess,
  onCancel,
}: MasterAdminForgotPinProps) {
  const [answer, setAnswer] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync: resetPin, isPending } =
    useResetMasterAdminPinWithSecurityAnswer();

  const question = masterAdmin.securityQuestion;

  if (!question) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>No security question set</span>
        </div>
        <p className="text-xs text-muted-foreground">
          The master admin has not set a security question. Contact an admin for
          manual PIN reset.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }

  async function handleReset() {
    if (!answer.trim()) {
      setError("Answer is required");
      return;
    }
    if (newPin.length !== 4) {
      setError("New PIN must be 4 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs don't match");
      return;
    }
    setError("");
    try {
      const answerHash = await hashPin(answer.trim().toLowerCase());
      const newPinHash = await hashPin(newPin);
      const ok = await resetPin({ answerHash, newPinHash });
      if (!ok) {
        setError("Security answer is incorrect");
        return;
      }
      toast.success("PIN reset successfully. Log in with your new PIN.");
      onSuccess(newPin);
    } catch {
      setError("Reset failed. Please try again.");
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Forgot PIN — Security Question</span>
      </div>
      <p className="text-xs font-medium text-foreground">{question}</p>
      <Input
        placeholder="Your answer…"
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        className="text-sm h-8"
        disabled={isPending}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          New PIN
        </span>
        <PinInput
          value={newPin}
          onChange={(v) => {
            setNewPin(v);
            setError("");
          }}
          disabled={isPending}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20 shrink-0">
          Confirm PIN
        </span>
        <PinInput
          value={confirmPin}
          onChange={(v) => {
            setConfirmPin(v);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleReset();
          }}
          disabled={isPending}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="h-8 text-xs px-3 bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleReset}
          disabled={
            !answer.trim() ||
            newPin.length !== 4 ||
            confirmPin.length !== 4 ||
            isPending
          }
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Reset PIN"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs px-3"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
interface UserRowProps {
  user: User;
  isActive: boolean;
  activeUser: User | null;
  onSetActive: (user: User | null) => void;
  onRenameUser?: (userId: bigint, newName: string) => void;
  allUsers?: User[];
}

type RowAction = "delete" | "setActive" | "changePin" | "forgotPin" | null;

function UserRow({
  user,
  isActive,
  activeUser,
  onSetActive,
  onRenameUser,
  allUsers = [],
}: UserRowProps) {
  const [action, setAction] = useState<RowAction>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const { mutateAsync: promoteUser, isPending: isPromoting } = usePromoteUser();
  const { mutateAsync: demoteUser, isPending: isDemoting } = useDemoteUser();
  const { mutateAsync: renameUser } = useRenameUser();

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handlePromote() {
    if (!activeUser) return;
    try {
      await promoteUser({ userId: user.id, actorUserId: activeUser.id });
      toast.success(`${user.name} promoted to admin`);
    } catch {
      toast.error("Failed to promote user");
    }
  }

  async function handleDemote() {
    if (!activeUser) return;
    try {
      await demoteUser({ userId: user.id, actorUserId: activeUser.id });
      toast.success(`${user.name} demoted to regular user`);
    } catch {
      toast.error("Failed to demote user");
    }
  }

  async function handleSaveName() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === user.name || !activeUser) {
      setIsEditingName(false);
      setEditName(user.name);
      return;
    }
    setIsSavingName(true);
    try {
      await renameUser({
        userId: user.id,
        newName: trimmed,
        actorUserId: activeUser.id,
      });
      onRenameUser?.(user.id, trimmed);
      toast.success("Name updated");
      setIsEditingName(false);
    } catch {
      toast.error("Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  }

  const isMasterAdminActive = activeUser?.isMasterAdmin === true;
  const canEditName = isActive || activeUser?.isMasterAdmin === true;

  const masterAdmin = allUsers.find((u) => u.isMasterAdmin);

  return (
    <div
      className={`group rounded-lg border transition-colors ${
        isActive ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      } p-3`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-display font-bold shrink-0 ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {initials}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setEditName(user.name);
                  }
                }}
                className="h-7 text-sm px-2 py-0"
                autoFocus
                disabled={isSavingName}
              />
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                onClick={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                onClick={() => {
                  setIsEditingName(false);
                  setEditName(user.name);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate">
                {user.name}
              </span>
              {canEditName && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                  onClick={() => {
                    setIsEditingName(true);
                    setEditName(user.name);
                  }}
                  title="Edit name"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {user.isMasterAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 rounded-full px-2 py-0.5 shrink-0">
                  <Crown className="h-2.5 w-2.5" />
                  Master Admin
                </span>
              )}
              {user.isAdmin && !user.isMasterAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 rounded-full px-2 py-0.5 shrink-0">
                  <Shield className="h-2.5 w-2.5" />
                  Admin
                </span>
              )}
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
                  <UserCheck className="h-2.5 w-2.5" />
                  Active
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Promote/demote — only for master admin, not on themselves or master admin */}
          {isMasterAdminActive &&
            !user.isMasterAdmin &&
            (user.isAdmin ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={handleDemote}
                disabled={isDemoting}
                title="Demote to regular user"
              >
                {isDemoting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserMinus className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2 text-muted-foreground hover:text-blue-600"
                onClick={handlePromote}
                disabled={isPromoting}
                title="Promote to admin"
              >
                {isPromoting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
              </Button>
            ))}
          {/* Change PIN — only for active user */}
          {isActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                setAction(action === "changePin" ? null : "changePin")
              }
              title="Change your PIN"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                setAction(action === "setActive" ? null : "setActive")
              }
              title="Set as active user"
            >
              <UserCheck className="h-3.5 w-3.5" />
            </Button>
          )}
          {isActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => onSetActive(null)}
              title="Clear active user"
            >
              <UserCheck className="h-3.5 w-3.5 text-primary" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => setAction(action === "delete" ? null : "delete")}
            title="Delete user"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Inline confirmation panels */}
      {action === "delete" && (
        <DeleteConfirm
          user={user}
          activeUser={activeUser}
          onSetActive={onSetActive}
          onCancel={() => setAction(null)}
        />
      )}
      {action === "setActive" && (
        <SetActiveConfirm
          user={user}
          activeUser={activeUser}
          onSuccess={(u) => {
            onSetActive(u);
            setAction(null);
          }}
          onCancel={() => setAction(null)}
          masterAdmin={masterAdmin}
        />
      )}
      {action === "changePin" && (
        <ChangePinForm user={user} onDone={() => setAction(null)} />
      )}
      {action === "forgotPin" && masterAdmin && (
        <MasterAdminForgotPin
          masterAdmin={masterAdmin}
          onSuccess={(newPin) => {
            void newPin;
            setAction(null);
          }}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}

// ── Master Admin Setup (shown on first launch) ────────────────────────────────
interface MasterAdminSetupProps {
  onComplete: (user: User) => void;
}

export function MasterAdminSetup({ onComplete }: MasterAdminSetupProps) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync: setupMasterAdmin, isPending } = useSetupMasterAdmin();
  const { mutateAsync: setSecurityQ } = useSetMasterAdminSecurityQuestion();
  const { data: users = [] } = useUsers();

  async function handleSetup() {
    const trimName = name.trim();
    if (!trimName) {
      setError("Name is required");
      return;
    }
    if (pin.length !== 4) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    setError("");
    try {
      const pinHash = await hashPin(pin);
      const userId = await setupMasterAdmin({ name: trimName, pinHash });
      toast.success(`Welcome, ${trimName}! Master admin account created.`);
      // Find the newly created user and set them as active
      const newUser: User = {
        id: userId,
        name: trimName,
        isAdmin: true,
        isMasterAdmin: true,
      };
      // Set security question if provided
      if (securityQuestion.trim() && securityAnswer.trim()) {
        try {
          const answerHash = await hashPin(securityAnswer.trim().toLowerCase());
          await setSecurityQ({
            question: securityQuestion.trim(),
            answerHash,
            actorUserId: userId,
          });
        } catch {
          // Non-fatal — user can set it later
        }
      }
      onComplete(newUser);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("already")) {
        // Already set up — reload the users list to get the master admin
        const masterAdmin = users.find((u) => u.isMasterAdmin);
        if (masterAdmin) {
          onComplete(masterAdmin);
        }
      } else {
        setError("Setup failed. Please try again.");
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-br from-amber-500/5 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-foreground">
                  Welcome to Kanban
                </h2>
                <p className="text-xs text-muted-foreground">
                  Set up your master admin account to get started
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="setup-name"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Your Name
              </label>
              <Input
                id="setup-name"
                placeholder="e.g. Terry Brutus"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetup();
                }}
                disabled={isPending}
                className="text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="setup-pin"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                4-Digit PIN
              </label>
              <PinInput
                id="setup-pin"
                value={pin}
                onChange={(v) => {
                  setPin(v);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetup();
                }}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="setup-confirm-pin"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Confirm PIN
              </label>
              <PinInput
                id="setup-confirm-pin"
                value={confirmPin}
                onChange={(v) => {
                  setConfirmPin(v);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetup();
                }}
                disabled={isPending}
              />
            </div>

            {/* Security question (optional) */}
            <div className="rounded-lg bg-secondary/50 border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Forgot-PIN Security Question{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </p>
              <Input
                placeholder="e.g. What was your first pet's name?"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                disabled={isPending}
                className="text-sm"
              />
              {securityQuestion.trim() && (
                <Input
                  placeholder="Your answer (stored securely)"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  disabled={isPending}
                  className="text-sm"
                  type="password"
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                If you forget your PIN, answering this question lets you reset
                it.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-1">
              <Button
                className="w-full gap-2"
                onClick={handleSetup}
                disabled={
                  !name.trim() ||
                  pin.length !== 4 ||
                  confirmPin.length !== 4 ||
                  isPending
                }
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    Create Master Admin
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              This account has full admin privileges and cannot be deleted.
              Store your PIN securely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Access Key section (master admin only) ────────────────────────────────────
const LS_KEY = "kanban_access_key";

interface AccessKeySectionProps {
  activeUser: User | null;
}

function AccessKeySection({ activeUser }: AccessKeySectionProps) {
  const { data: currentKey, isLoading } = useGetAccessKey();
  const { mutateAsync: setAccessKey, isPending: isSaving } = useSetAccessKey();

  const [showCurrentKey, setShowCurrentKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!activeUser?.isMasterAdmin) return null;

  async function handleSave() {
    const trimmed = newKey.trim();
    if (trimmed.length < 6) {
      setKeyError("Access key must be at least 6 characters");
      return;
    }
    setKeyError("");
    try {
      await setAccessKey({ newKey: trimmed, actorUserId: activeUser!.id });
      // Update localStorage so current session stays unlocked
      localStorage.setItem(LS_KEY, trimmed);
      setNewKey("");
      setSaveSuccess(true);
      toast.success("Access key updated successfully");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      toast.error("Failed to update access key");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-column overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Access Key
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Controls who can enter the real app. Only you (master admin) can view
          or change this.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Current key (masked) */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Current Key
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 px-3 rounded-md border border-border bg-secondary/40 flex items-center text-sm font-mono text-foreground">
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : showCurrentKey ? (
                currentKey || "—"
              ) : (
                "••••••••"
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCurrentKey((p) => !p)}
              className="h-9 w-9 rounded-md border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={showCurrentKey ? "Hide key" : "Reveal key"}
            >
              {showCurrentKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* New key input */}
        <div className="space-y-1.5">
          <label
            htmlFor="access-key-input"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            New Access Key
          </label>
          <Input
            id="access-key-input"
            type="text"
            placeholder="Enter new key (min. 6 characters)"
            value={newKey}
            onChange={(e) => {
              setNewKey(e.target.value);
              setKeyError("");
              setSaveSuccess(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            disabled={isSaving}
            className="text-sm"
          />
          {keyError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {keyError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5 shrink-0" />
              Access key saved
            </p>
          )}
        </div>

        <Button
          className="w-full gap-2"
          onClick={handleSave}
          disabled={!newKey.trim() || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              Update Access Key
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── UsersTab ──────────────────────────────────────────────────────────────────
interface UsersTabProps {
  activeUser: User | null;
  onSetActiveUser: (user: User | null) => void;
  onRenameUser?: (userId: bigint, newName: string) => void;
}

export default function UsersTab({
  activeUser,
  onSetActiveUser,
  onRenameUser,
}: UsersTabProps) {
  const { data: users = [], isLoading } = useUsers();
  const { mutateAsync: createUser, isPending: isCreating } = useCreateUser();

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [nameError, setNameError] = useState("");

  async function handleAddUser() {
    const trimName = name.trim();
    if (!trimName) {
      setNameError("Name is required");
      return;
    }
    if (pin.length !== 4) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }
    setNameError("");
    setPinError("");

    try {
      const pinHash = await hashPin(pin);
      await createUser({ name: trimName, pinHash });
      setName("");
      setPin("");
      toast.success(`User "${trimName}" added`);
    } catch {
      toast.error("Failed to add user");
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
      {/* Access key section — master admin only */}
      <AccessKeySection activeUser={activeUser} />

      {/* Add user form */}
      <div className="rounded-xl border border-border bg-card shadow-column overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Add User
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create a user account with a 4-digit PIN for collaboration.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="user-name-input"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Name
            </label>
            <Input
              id="user-name-input"
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddUser();
              }}
              disabled={isCreating}
              className="text-sm"
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="user-pin-input"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              4-Digit PIN
            </label>
            <PinInput
              id="user-pin-input"
              value={pin}
              onChange={(v) => {
                setPin(v);
                setPinError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddUser();
              }}
              disabled={isCreating}
            />
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
          </div>
          <Button
            className="w-full gap-2"
            onClick={handleAddUser}
            disabled={!name.trim() || pin.length !== 4 || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add User
              </>
            )}
          </Button>
        </div>
      </div>

      {/* User list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-base text-foreground">
            Collaborators
          </h2>
          <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg shimmer" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center py-12 text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-1">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No users yet</p>
            <p className="text-xs text-muted-foreground">
              Add the first collaborator using the form above.
            </p>
          </div>
        ) : (
          <div
            className="space-y-2 overflow-y-auto pr-1"
            style={{ maxHeight: "calc(100vh - 480px)", minHeight: "60px" }}
          >
            {users.map((user) => (
              <UserRow
                key={user.id.toString()}
                user={user}
                isActive={activeUser?.id === user.id}
                activeUser={activeUser}
                onSetActive={onSetActiveUser}
                onRenameUser={onRenameUser}
                allUsers={users}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
