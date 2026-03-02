import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kanban, KeyRound, Loader2, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGetAccessKey } from "../hooks/useQueries";

const LS_KEY = "kanban_access_key";

interface AccessKeyGateProps {
  onUnlocked: () => void;
}

export default function AccessKeyGate({ onUnlocked }: AccessKeyGateProps) {
  const { data: backendKey, isLoading: isLoadingKey } = useGetAccessKey();

  // "checking" = still loading or verifying saved key
  // "prompt" = showing the input prompt
  const [phase, setPhase] = useState<"checking" | "prompt">("checking");
  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoadingKey || backendKey === undefined) return;

    const saved = localStorage.getItem(LS_KEY);
    if (saved && saved === backendKey) {
      // Auto-unlock: saved key matches
      onUnlocked();
    } else {
      // Need to prompt
      setPhase("prompt");
    }
  }, [isLoadingKey, backendKey, onUnlocked]);

  useEffect(() => {
    if (phase === "prompt") {
      // Small delay to allow animation to settle, then focus
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [phase]);

  function handleSubmit() {
    if (!inputKey.trim()) return;
    if (inputKey === backendKey) {
      localStorage.setItem(LS_KEY, inputKey);
      onUnlocked();
    } else {
      setError("Incorrect access key. Try again.");
      setInputKey("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Full-screen overlay — never flash between states
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      {/* Subtle grid pattern background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, oklch(var(--border)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          opacity: 0.5,
        }}
      />

      {phase === "checking" ? (
        // Loading spinner — shown while verifying saved key
        <div className="relative flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl col-accent-0 col-accent-bar flex items-center justify-center shadow-lg">
            <Kanban className="h-7 w-7 text-white" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        // Access key prompt
        <div
          className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          style={{ boxShadow: "0 24px 64px oklch(var(--foreground) / 0.12)" }}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full col-accent-0 col-accent-bar" />

          <div className="px-8 pt-8 pb-8 space-y-6">
            {/* Logo + title */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl col-accent-0 col-accent-bar flex items-center justify-center shadow-lg">
                <Kanban className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-foreground tracking-tight">
                  Kanban Board
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  This workspace is private
                </p>
              </div>
            </div>

            {/* Input section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span>Enter access key to continue</span>
              </div>

              <Input
                ref={inputRef}
                type="password"
                placeholder="Access key"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                className="text-sm h-11"
                autoComplete="off"
              />

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              className="w-full h-10 gap-2"
              onClick={handleSubmit}
              disabled={!inputKey.trim()}
            >
              <KeyRound className="h-4 w-4" />
              Enter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
