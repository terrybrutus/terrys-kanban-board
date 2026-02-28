import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Card, ColumnView, Project, Revision } from "../backend.d";
import { useActor } from "./useActor";

export interface User {
  id: bigint;
  name: string;
}

// ─── Project hooks ─────────────────────────────────────────────────────────────

export function useProjects() {
  const { actor, isFetching } = useActor();
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getProjects();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useInitDefaultProject() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<bigint> => {
      if (!actor) throw new Error("No actor");
      return actor.initDefaultProject();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useCreateProject() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      actorUserId = 0n,
    }: { name: string; actorUserId?: bigint }): Promise<bigint> => {
      if (!actor) throw new Error("No actor");
      return actor.createProject(name, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useRenameProject() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      newName,
      actorUserId = 0n,
    }: {
      projectId: bigint;
      newName: string;
      actorUserId?: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.renameProject(projectId, newName, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      actorUserId = 0n,
    }: {
      projectId: bigint;
      actorUserId?: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.deleteProject(projectId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Also invalidate board data since a project's columns/cards are gone
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["revisions"] });
    },
  });
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useColumns(projectId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<ColumnView[]>({
    queryKey: ["columns", projectId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || projectId === null) return [];
      return actor.getColumns(projectId);
    },
    enabled: !!actor && !isFetching && projectId !== null,
  });
}

export function useCards(projectId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Card[]>({
    queryKey: ["cards", projectId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || projectId === null) return [];
      return actor.getCards(projectId);
    },
    enabled: !!actor && !isFetching && projectId !== null,
  });
}

export function useRevisions(projectId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Revision[]>({
    queryKey: ["revisions", projectId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || projectId === null) return [];
      return actor.getRevisions(projectId);
    },
    enabled: !!actor && !isFetching && projectId !== null,
  });
}

export function useCardRevisions(cardId: bigint) {
  const { actor, isFetching } = useActor();
  return useQuery<Revision[]>({
    queryKey: ["cardRevisions", cardId.toString()],
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
    mutationFn: async ({
      name,
      actorUserId = 0n,
      projectId,
    }: {
      name: string;
      actorUserId?: bigint;
      projectId: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.createColumn(name, actorUserId, projectId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["columns", variables.projectId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["revisions", variables.projectId.toString()],
      });
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
      projectId: _projectId,
    }: {
      columnId: bigint;
      newName: string;
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.renameColumn(columnId, newName, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["columns"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
    },
  });
}

export function useDeleteColumn() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      columnId,
      actorUserId = 0n,
      projectId: _projectId,
    }: {
      columnId: bigint;
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteColumn(columnId, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["cards", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["columns"] });
        queryClient.invalidateQueries({ queryKey: ["cards"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
    },
  });
}

export function useReorderColumns() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      newOrder,
      actorUserId = 0n,
      projectId: _projectId,
    }: {
      newOrder: bigint[];
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.reorderColumns(newOrder, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["columns"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
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
      projectId,
    }: {
      title: string;
      description: string | null;
      columnId: bigint;
      actorUserId?: bigint;
      projectId: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.createCard(
        title,
        description,
        columnId,
        actorUserId,
        projectId,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cards", variables.projectId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["columns", variables.projectId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["revisions", variables.projectId.toString()],
      });
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
      projectId: _projectId,
    }: {
      cardId: bigint;
      title: string;
      description: string | null;
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.updateCard(cardId, title, description, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["cards", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cards"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
    },
  });
}

export function useDeleteCard() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      actorUserId = 0n,
      projectId: _projectId,
    }: {
      cardId: bigint;
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteCard(cardId, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["cards", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cards"] });
        queryClient.invalidateQueries({ queryKey: ["columns"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
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
      projectId: _projectId,
    }: {
      cardId: bigint;
      targetColumnId: bigint;
      newPosition: bigint;
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.moveCard(cardId, targetColumnId, newPosition, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["cards", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cards"] });
        queryClient.invalidateQueries({ queryKey: ["columns"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
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
      projectId: _projectId,
    }: {
      cardId: bigint;
      userId: bigint | null;
      actorUserId?: bigint;
      projectId?: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.assignCard(cardId, userId, actorUserId);
    },
    onSuccess: (_data, variables) => {
      if (variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: ["cards", variables.projectId.toString()],
        });
        queryClient.invalidateQueries({
          queryKey: ["revisions", variables.projectId.toString()],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["cards"] });
        queryClient.invalidateQueries({ queryKey: ["revisions"] });
      }
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
    mutationFn: async ({
      name,
      pinHash,
    }: { name: string; pinHash: string }) => {
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
    mutationFn: async ({
      userId,
      pinHash,
    }: { userId: bigint; pinHash: string }) => {
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
