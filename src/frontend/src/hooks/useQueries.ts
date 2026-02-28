import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Card,
  ColumnView,
  Comment,
  FilterPreset,
  Project,
  Revision,
  Tag,
} from "../backend.d";
import { useActor } from "./useActor";

export interface User {
  id: bigint;
  name: string;
  isAdmin: boolean;
  isMasterAdmin: boolean;
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
      return raw.map((u) => ({
        id: u.id,
        name: u.name,
        isAdmin: u.isAdmin,
        isMasterAdmin: u.isMasterAdmin,
      }));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useIsAdminSetup() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["isAdminSetup"],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isAdminSetup();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetupMasterAdmin() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      pinHash,
    }: { name: string; pinHash: string }): Promise<bigint> => {
      if (!actor) throw new Error("No actor");
      return actor.setupMasterAdmin(name, pinHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["isAdminSetup"] });
    },
  });
}

export function usePromoteUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      actorUserId,
    }: { userId: bigint; actorUserId: bigint }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.promoteUser(userId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDemoteUser() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      actorUserId,
    }: { userId: bigint; actorUserId: bigint }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.demoteUser(userId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
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
    mutationFn: async ({
      userId,
      actorUserId,
    }: { userId: bigint; actorUserId: bigint }) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteUser(userId, actorUserId);
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
      actorUserId,
      newPinHash,
    }: {
      userId: bigint;
      actorUserId: bigint;
      newPinHash: string;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.resetUserPin(userId, actorUserId, newPinHash);
    },
  });
}

// ─── Tag hooks ────────────────────────────────────────────────────────────────

export function useProjectTags(projectId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Tag[]>({
    queryKey: ["tags", projectId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || projectId === null) return [];
      return actor.getProjectTags(projectId);
    },
    enabled: !!actor && !isFetching && projectId !== null,
  });
}

export function useCreateTag() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      color,
      actorUserId,
    }: {
      projectId: bigint;
      name: string;
      color: string;
      actorUserId: bigint;
    }): Promise<bigint> => {
      if (!actor) throw new Error("No actor");
      return actor.createTag(projectId, name, color, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tags", variables.projectId.toString()],
      });
    },
  });
}

export function useRenameTag() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tagId,
      newName,
      actorUserId,
      projectId: _projectId,
    }: {
      tagId: bigint;
      newName: string;
      actorUserId: bigint;
      projectId: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.renameTag(tagId, newName, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tags", variables.projectId.toString()],
      });
    },
  });
}

export function useDeleteTag() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tagId,
      actorUserId,
      projectId: _projectId,
    }: {
      tagId: bigint;
      actorUserId: bigint;
      projectId: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.deleteTag(tagId, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tags", variables.projectId.toString()],
      });
      // Also invalidate cards since they may have references to this tag
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });
}

export function useUpdateCardTags() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      tagIds,
      actorUserId,
      projectId: _projectId,
    }: {
      cardId: bigint;
      tagIds: bigint[];
      actorUserId: bigint;
      projectId: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.updateCardTags(cardId, tagIds, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tags", variables.projectId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["cards", variables.projectId.toString()],
      });
    },
  });
}

export function useUpdateCardDueDate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      dueDate,
      actorUserId,
      projectId: _projectId,
    }: {
      cardId: bigint;
      dueDate: bigint | null;
      actorUserId: bigint;
      projectId: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.updateCardDueDate(cardId, dueDate, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cards", variables.projectId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["revisions", variables.projectId.toString()],
      });
    },
  });
}

// ─── Comment hooks ────────────────────────────────────────────────────────────

export function useCardComments(cardId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Comment[]>({
    queryKey: ["comments", cardId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || cardId === null) return [];
      return actor.getCardComments(cardId);
    },
    enabled: !!actor && !isFetching && cardId !== null,
  });
}

export function useAddComment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardId,
      text,
      actorUserId,
    }: {
      cardId: bigint;
      text: string;
      actorUserId: bigint;
    }): Promise<bigint> => {
      if (!actor) throw new Error("No actor");
      return actor.addComment(cardId, text, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.cardId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["cardRevisions", variables.cardId.toString()],
      });
    },
  });
}

export function useDeleteComment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      actorUserId,
      cardId: _cardId,
    }: {
      commentId: bigint;
      actorUserId: bigint;
      cardId: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.deleteComment(commentId, actorUserId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.cardId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["cardRevisions", variables.cardId.toString()],
      });
    },
  });
}

// ─── Filter preset hooks ──────────────────────────────────────────────────────

export function useFilterPresets(projectId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<FilterPreset[]>({
    queryKey: ["filterPresets", projectId?.toString() ?? "none"],
    queryFn: async () => {
      if (!actor || projectId === null) return [];
      return actor.getFilterPresets(projectId);
    },
    enabled: !!actor && !isFetching && projectId !== null,
  });
}

export function useSaveFilterPreset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      createdByUserId,
      name,
      assigneeId,
      tagIds,
      unassignedOnly,
      textSearch,
      dateField,
      dateFrom,
      dateTo,
    }: {
      projectId: bigint;
      createdByUserId: bigint;
      name: string;
      assigneeId: bigint | null;
      tagIds: bigint[];
      unassignedOnly: boolean;
      textSearch: string;
      dateField: string | null;
      dateFrom: string;
      dateTo: string;
    }): Promise<bigint> => {
      if (!actor) throw new Error("No actor");
      return actor.saveFilterPreset(
        projectId,
        createdByUserId,
        name,
        assigneeId,
        tagIds,
        unassignedOnly,
        textSearch,
        dateField,
        dateFrom,
        dateTo,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filterPresets"] });
    },
  });
}

export function useDeleteFilterPreset() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      presetId,
      actorUserId,
    }: {
      presetId: bigint;
      actorUserId: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.deleteFilterPreset(presetId, actorUserId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filterPresets"] });
    },
  });
}

// ─── Multi-move hook ──────────────────────────────────────────────────────────

export function useMoveCards() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cardIds,
      targetColumnId,
      actorUserId,
      projectId: _projectId,
    }: {
      cardIds: bigint[];
      targetColumnId: bigint;
      actorUserId: bigint;
      projectId?: bigint;
    }): Promise<void> => {
      if (!actor) throw new Error("No actor");
      return actor.moveCards(cardIds, targetColumnId, actorUserId);
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
