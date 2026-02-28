import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import type { Card, ColumnView, Revision } from "../backend.d";

export interface User {
  id: bigint;
  name: string;
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useColumns() {
  const { actor, isFetching } = useActor();
  return useQuery<ColumnView[]>({
    queryKey: ["columns"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getColumns();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCards() {
  const { actor, isFetching } = useActor();
  return useQuery<Card[]>({
    queryKey: ["cards"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCards();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useRevisions() {
  const { actor, isFetching } = useActor();
  return useQuery<Revision[]>({
    queryKey: ["revisions"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRevisions();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCardRevisions(cardId: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<Revision[]>({
    queryKey: ["revisions", cardId.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCardRevisions(cardId);
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useInitBoard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      await actor.initBoard();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });
}

export function useCreateColumn() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, actorUserId = 0n }: { name: string; actorUserId?: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.createColumn(name, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useRenameColumn() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      columnId,
      newName,
      actorUserId = 0n,
    }: {
      columnId: bigint;
      newName: string;
      actorUserId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.renameColumn(columnId, newName, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useDeleteColumn() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ columnId, actorUserId = 0n }: { columnId: bigint; actorUserId?: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteColumn(columnId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useReorderColumns() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ newOrder, actorUserId = 0n }: { newOrder: bigint[]; actorUserId?: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.reorderColumns(newOrder, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useCreateCard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      title,
      description,
      columnId,
      actorUserId = 0n,
    }: {
      title: string;
      description: string | null;
      columnId: bigint;
      actorUserId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.createCard(title, description, columnId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useUpdateCard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      title,
      description,
      actorUserId = 0n,
    }: {
      cardId: bigint;
      title: string;
      description: string | null;
      actorUserId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateCard(cardId, title, description, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useDeleteCard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, actorUserId = 0n }: { cardId: bigint; actorUserId?: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteCard(cardId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useMoveCard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      targetColumnId,
      newPosition,
      actorUserId = 0n,
    }: {
      cardId: bigint;
      targetColumnId: bigint;
      newPosition: bigint;
      actorUserId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.moveCard(cardId, targetColumnId, newPosition, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

export function useAssignCard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      userId,
      actorUserId = 0n,
    }: {
      cardId: bigint;
      userId: bigint | null;
      actorUserId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.assignCard(cardId, userId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

// ─── User hooks ───────────────────────────────────────────────────────────────

export function useUsers() {
  const { actor, isFetching } = useActor();
  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      if (!actor) return [];
      const raw = await actor.getUsers();
      // backend now returns Array<User> with { id, name, pinHash }
      return raw.map((u) => ({ id: u.id, name: u.name }));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, pinHash }: { name: string; pinHash: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.createUser(name, pinHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteUser(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useVerifyPin() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({ userId, pinHash }: { userId: bigint; pinHash: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.verifyPin(userId, pinHash);
    },
  });
}

export function useChangeUserPin() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      userId,
      oldPinHash,
      newPinHash,
    }: {
      userId: bigint;
      oldPinHash: string;
      newPinHash: string;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.changeUserPin(userId, oldPinHash, newPinHash);
    },
  });
}

export function useResetUserPin() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      userId,
      adminPinHash,
      newPinHash,
    }: {
      userId: bigint;
      adminPinHash: string;
      newPinHash: string;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.resetUserPin(userId, adminPinHash, newPinHash);
    },
  });
}

export function useSetAdminPin() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (newPinHash: string) => {
      if (!actor) throw new Error("No actor");
      return actor.setAdminPin(newPinHash);
    },
  });
}
