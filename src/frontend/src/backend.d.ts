import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Swimlane {
    id: bigint;
    order: bigint;
    name: string;
    projectId: bigint;
}
export interface ColumnView {
    id: bigint;
    name: string;
    projectId: bigint;
    cardIds: Array<bigint>;
}
export interface Tag {
    id: bigint;
    name: string;
    color: string;
    projectId: bigint;
}
export interface Comment {
    id: bigint;
    authorId: bigint;
    text: string;
    authorName: string;
    timestamp: bigint;
    cardId: bigint;
}
export interface Card {
    id: bigint;
    title: string;
    createdAt: bigint;
    tags: Array<bigint>;
    dueDate?: bigint;
    description?: string;
    isArchived: boolean;
    projectId: bigint;
    assignedUserId?: bigint;
    swimlaneId?: bigint;
    columnId: bigint;
    archivedAt?: bigint;
}
export interface User {
    id: bigint;
    isMasterAdmin: boolean;
    name: string;
    securityQuestion?: string;
    pinHash: string;
    isAdmin: boolean;
    securityAnswerHash?: string;
}
export interface ChecklistItem {
    id: bigint;
    order: bigint;
    createdAt: bigint;
    text: string;
    isDone: boolean;
    cardId: bigint;
}
export interface Project {
    id: bigint;
    name: string;
    swimlanesEnabled: boolean;
}
export interface FilterPreset {
    id: bigint;
    dateTo: string;
    assigneeId?: bigint;
    createdByUserId: bigint;
    name: string;
    tagIds: Array<bigint>;
    projectId: bigint;
    textSearch: string;
    unassignedOnly: boolean;
    dateFrom: string;
    dateField?: string;
}
export interface Revision {
    id: bigint;
    actorName: string;
    description: string;
    projectId: bigint;
    timestamp: bigint;
    cardId?: bigint;
    revisionType: string;
}
export interface ProjectSummary {
    unassignedCount: bigint;
    totalCards: bigint;
    overdueCount: bigint;
    dueSoonCount: bigint;
    tagCounts: Array<[bigint, bigint]>;
}
export interface backendInterface {
    addChecklistItem(cardId: bigint, text: string, actorUserId: bigint): Promise<bigint>;
    addComment(cardId: bigint, text: string, actorUserId: bigint): Promise<bigint>;
    archiveCard(cardId: bigint, actorUserId: bigint): Promise<void>;
    assignCard(cardId: bigint, userId: bigint | null, actorUserId: bigint): Promise<void>;
    changeUserPin(userId: bigint, oldPinHash: string, newPinHash: string): Promise<void>;
    clearRevisions(): Promise<void>;
    createCard(title: string, description: string | null, columnId: bigint, actorUserId: bigint, projectId: bigint): Promise<bigint>;
    createColumn(name: string, actorUserId: bigint, projectId: bigint): Promise<bigint>;
    createProject(name: string, actorUserId: bigint): Promise<bigint>;
    createSwimlane(projectId: bigint, name: string, actorUserId: bigint): Promise<bigint>;
    createTag(projectId: bigint, name: string, color: string, actorUserId: bigint): Promise<bigint>;
    createUser(name: string, pinHash: string): Promise<bigint>;
    deleteCard(cardId: bigint, actorUserId: bigint): Promise<void>;
    deleteChecklistItem(itemId: bigint, actorUserId: bigint): Promise<void>;
    deleteColumn(columnId: bigint, actorUserId: bigint): Promise<void>;
    deleteComment(commentId: bigint, actorUserId: bigint): Promise<void>;
    deleteFilterPreset(presetId: bigint, actorUserId: bigint): Promise<void>;
    deleteProject(projectId: bigint, actorUserId: bigint): Promise<void>;
    deleteSwimlane(swimlaneId: bigint, actorUserId: bigint): Promise<void>;
    deleteTag(tagId: bigint, actorUserId: bigint): Promise<void>;
    deleteUser(userId: bigint, actorUserId: bigint): Promise<void>;
    demoteUser(userId: bigint, actorUserId: bigint): Promise<void>;
    disableSwimlanes(projectId: bigint, actorUserId: bigint): Promise<void>;
    enableSwimlanes(projectId: bigint, actorUserId: bigint): Promise<void>;
    getAccessKey(): Promise<string>;
    getArchivedCards(projectId: bigint): Promise<Array<Card>>;
    getCardComments(cardId: bigint): Promise<Array<Comment>>;
    getCardRevisions(cardId: bigint): Promise<Array<Revision>>;
    getCards(projectId: bigint): Promise<Array<Card>>;
    getChecklistItems(cardId: bigint): Promise<Array<ChecklistItem>>;
    getColumns(projectId: bigint): Promise<Array<ColumnView>>;
    getFilterPresets(projectId: bigint): Promise<Array<FilterPreset>>;
    getProjectSummary(projectId: bigint): Promise<ProjectSummary>;
    getProjectTags(projectId: bigint): Promise<Array<Tag>>;
    getProjects(): Promise<Array<Project>>;
    getRevisions(projectId: bigint): Promise<Array<Revision>>;
    getSwimlanes(projectId: bigint): Promise<Array<Swimlane>>;
    getUsers(): Promise<Array<User>>;
    initBoard(): Promise<void>;
    initDefaultProject(): Promise<bigint>;
    isAdminSetup(): Promise<boolean>;
    moveCard(cardId: bigint, targetColumnId: bigint, newPosition: bigint, actorUserId: bigint): Promise<void>;
    moveCards(cardIds: Array<bigint>, targetColumnId: bigint, actorUserId: bigint): Promise<void>;
    promoteUser(userId: bigint, actorUserId: bigint): Promise<void>;
    renameColumn(columnId: bigint, newName: string, actorUserId: bigint): Promise<void>;
    renameProject(projectId: bigint, newName: string, actorUserId: bigint): Promise<void>;
    renameSwimlane(swimlaneId: bigint, newName: string, actorUserId: bigint): Promise<void>;
    renameTag(tagId: bigint, newName: string, actorUserId: bigint): Promise<void>;
    renameUser(userId: bigint, newName: string, actorUserId: bigint): Promise<void>;
    reorderChecklistItems(cardId: bigint, newOrder: Array<bigint>, actorUserId: bigint): Promise<void>;
    reorderColumns(newOrder: Array<bigint>, actorUserId: bigint): Promise<void>;
    reorderSwimlanes(newOrder: Array<bigint>, actorUserId: bigint): Promise<void>;
    resetMasterAdminPinWithSecurityAnswer(answerHash: string, newPinHash: string): Promise<boolean>;
    resetUserPin(userId: bigint, actorUserId: bigint, newPinHash: string): Promise<void>;
    restoreCard(cardId: bigint, actorUserId: bigint): Promise<void>;
    saveFilterPreset(projectId: bigint, createdByUserId: bigint, name: string, assigneeId: bigint | null, tagIds: Array<bigint>, unassignedOnly: boolean, textSearch: string, dateField: string | null, dateFrom: string, dateTo: string): Promise<bigint>;
    setAccessKey(newKey: string, actorUserId: bigint): Promise<void>;
    setMasterAdminSecurityQuestion(question: string, answerHash: string, actorUserId: bigint): Promise<void>;
    setupMasterAdmin(name: string, pinHash: string): Promise<bigint>;
    updateCard(cardId: bigint, title: string, description: string | null, actorUserId: bigint): Promise<void>;
    updateCardDueDate(cardId: bigint, dueDate: bigint | null, actorUserId: bigint): Promise<void>;
    updateCardSwimlane(cardId: bigint, swimlaneId: bigint | null, actorUserId: bigint): Promise<void>;
    updateCardTags(cardId: bigint, tagIds: Array<bigint>, actorUserId: bigint): Promise<void>;
    updateChecklistItem(itemId: bigint, text: string, isDone: boolean, actorUserId: bigint): Promise<void>;
    verifyPin(userId: bigint, pinHash: string): Promise<boolean>;
}
