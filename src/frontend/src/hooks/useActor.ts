import { useActor as useCaffeineActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";
import type { backendInterface } from "../backend.d";

export function useActor(): {
  actor: backendInterface | null;
  isFetching: boolean;
} {
  return useCaffeineActor(createActor) as {
    actor: backendInterface | null;
    isFetching: boolean;
  };
}
