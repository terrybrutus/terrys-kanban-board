import { useState } from "react";
import {
  UserPlus,
  Trash2,
  Loader2,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useVerifyPin,
  useChangeUserPin,
  useResetUserPin,
  useSetAdminPin,
} from "../hooks/useQueries";
import type { User } from "../hooks/useQueries";

// ── PIN hashing ──────────────────────────────────────────────────────────────
async function hashPin(pin: string): Promise<string> {
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

function PinInput({ value, onChange, onKeyDown, disabled, placeholder = "••••", autoFocus, id }: PinInputProps) {
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

// ── Forgot/Admin-reset subform (used in both Delete and SetActive flows) ──────
interface AdminResetFormProps {
  user: User;
  onSuccess: (newPin: string) => void;
  onCancel: () => void;
}

function AdminResetForm({ user, onSuccess, onCancel }: AdminResetFormProps) {
  const [adminPin, setAdminPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync: resetUserPin, isPending } = useResetUserPin();

  async function handleReset() {
    if (adminPin.length !== 4 || newPin.length !== 4) {
      setError("Both PINs must be 4 digits");
      return;
    }
    setError("");
    try {
      const adminHash = await hashPin(adminPin);
      const newHash = await hashPin(newPin);
      await resetUserPin({ userId: user.id, adminPinHash: adminHash, newPinHash: newHash });
      toast.success("PIN reset successfully");
      onSuccess(newPin);
    } catch {
      setError("Admin PIN is incorrect or reset failed");
    }
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>Admin PIN reset</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">Admin PIN</span>
          <PinInput
            value={adminPin}
            onChange={(v) => { setAdminPin(v); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
            disabled={isPending}
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">New PIN</span>
          <PinInput
            value={newPin}
            onChange={(v) => { setNewPin(v); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-8 text-xs px-3 bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleReset}
          disabled={adminPin.length !== 4 || newPin.length !== 4 || isPending}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reset PIN"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs px-3" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Delete confirmation dialog (inline per row) ───────────────────────────────
interface DeleteConfirmProps {
  user: User;
  activeUser: User | null;
  onSetActive: (user: User) => void;
  onCancel: () => void;
}

function DeleteConfirm({ user, activeUser, onSetActive, onCancel }: DeleteConfirmProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const { mutateAsync: verifyPin, isPending: isVerifying } = useVerifyPin();
  const { mutateAsync: deleteUser, isPending: isDeleting } = useDeleteUser();

  const isPending = isVerifying || isDeleting;

  async function handleConfirm() {
    if (pin.length !== 4) {
      setError("Enter your 4-digit PIN");
      return;
    }
    setError("");
    try {
      const pinHash = await hashPin(pin);
      const valid = await verifyPin({ userId: user.id, pinHash });
      if (!valid) {
        setError("Incorrect PIN. Only you can delete your account.");
        return;
      }
      await deleteUser(user.id);
      if (activeUser?.id === user.id) {
        onSetActive(null as unknown as User);
      }
      toast.success(`User "${user.name}" removed`);
    } catch {
      toast.error("Failed to delete user");
    }
  }

  if (showForgot) {
    return (
      <AdminResetForm
        user={user}
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
        <span>Enter your PIN to confirm deletion</span>
      </div>
      <div className="flex items-center gap-2">
        <PinInput
          value={pin}
          onChange={(v) => { setPin(v); setError(""); }}
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
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
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
        Forgot PIN? Reset with admin PIN
      </button>
    </div>
  );
}

// ── Set Active confirmation dialog (inline per row) ───────────────────────────
interface SetActiveConfirmProps {
  user: User;
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

function SetActiveConfirm({ user, onSuccess, onCancel }: SetActiveConfirmProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
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
      <AdminResetForm
        user={user}
        onSuccess={(newPin) => {
          setPin(newPin);
          setShowForgot(false);
          // Auto-verify with the new PIN
          handleConfirm(newPin);
        }}
        onCancel={() => setShowForgot(false)}
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
          onChange={(v) => { setPin(v); setError(""); }}
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
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
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
        Forgot PIN? Reset with admin PIN
      </button>
    </div>
  );
}

// ── Change PIN form (shown for active user in their own row) ──────────────────
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
      await changeUserPin({ userId: user.id, oldPinHash: oldHash, newPinHash: newHash });
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
          <span className="text-xs text-muted-foreground w-20 shrink-0">Current PIN</span>
          <PinInput
            value={oldPin}
            onChange={(v) => { setOldPin(v); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Escape") onDone(); }}
            disabled={isPending}
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">New PIN</span>
          <PinInput
            value={newPin}
            onChange={(v) => { setNewPin(v); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Escape") onDone(); }}
            disabled={isPending}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 shrink-0">Confirm PIN</span>
          <PinInput
            value={confirmPin}
            onChange={(v) => { setConfirmPin(v); setError(""); }}
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
          disabled={oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4 || isPending}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update PIN"}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs px-3" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
interface UserRowProps {
  user: User;
  isActive: boolean;
  activeUser: User | null;
  onSetActive: (user: User | null) => void;
}

type RowAction = "delete" | "setActive" | "changePin" | null;

function UserRow({ user, isActive, activeUser, onSetActive }: UserRowProps) {
  const [action, setAction] = useState<RowAction>(null);

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
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

        {/* Name + active badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {user.name}
            </span>
            {isActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
                <UserCheck className="h-2.5 w-2.5" />
                Active
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Change PIN — only for currently active user */}
          {isActive && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setAction(action === "changePin" ? null : "changePin")}
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
              onClick={() => setAction(action === "setActive" ? null : "setActive")}
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
          onSuccess={(u) => {
            onSetActive(u);
            setAction(null);
          }}
          onCancel={() => setAction(null)}
        />
      )}
      {action === "changePin" && (
        <ChangePinForm
          user={user}
          onDone={() => setAction(null)}
        />
      )}
    </div>
  );
}

// ── Admin PIN setup card ──────────────────────────────────────────────────────
function AdminPinCard() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const { mutateAsync: setAdminPin, isPending } = useSetAdminPin();

  async function handleSet() {
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }
    setError("");
    try {
      const pinHash = await hashPin(pin);
      await setAdminPin(pinHash);
      toast.success("Admin PIN set successfully");
      setIsConfigured(true);
      setPin("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("already set")) {
        setIsConfigured(true);
      } else {
        setError("Failed to set admin PIN");
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-column overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <h2 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          Admin PIN
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Used to reset any user's forgotten PIN.
        </p>
      </div>
      <div className="p-5">
        {isConfigured ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Admin PIN is configured</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <PinInput
                value={pin}
                onChange={(v) => { setPin(v); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSet(); }}
                disabled={isPending}
              />
              <Button
                size="sm"
                className="h-8 text-xs px-4 gap-1.5"
                onClick={handleSet}
                disabled={pin.length !== 4 || isPending}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3" />
                    Set Admin PIN
                  </>
                )}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Store this PIN securely — it can reset any user's PIN.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── UsersTab ──────────────────────────────────────────────────────────────────
interface UsersTabProps {
  activeUser: User | null;
  onSetActiveUser: (user: User | null) => void;
}

export default function UsersTab({ activeUser, onSetActiveUser }: UsersTabProps) {
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
            <label htmlFor="user-name-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
            <label htmlFor="user-pin-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              4-Digit PIN
            </label>
            <PinInput
              id="user-pin-input"
              value={pin}
              onChange={(v) => { setPin(v); setPinError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddUser(); }}
              disabled={isCreating}
            />
            {pinError && (
              <p className="text-xs text-destructive">{pinError}</p>
            )}
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

      {/* Admin PIN setup */}
      <AdminPinCard />

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
            style={{ maxHeight: "calc(100vh - 520px)", minHeight: "60px" }}
          >
            {users.map((user) => (
              <UserRow
                key={user.id.toString()}
                user={user}
                isActive={activeUser?.id === user.id}
                activeUser={activeUser}
                onSetActive={onSetActiveUser}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
