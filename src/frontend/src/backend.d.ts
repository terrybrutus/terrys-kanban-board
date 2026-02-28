import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ColumnView {
    id: bigint;
    name: string;
    cardIds: Array<bigint>;
}
export interface Card {
    id: bigint;
    title: string;
    description?: string;
    assignedUserId?: bigint;
    columnId: bigint;
}
export interface Revision {
    id: bigint;
    actorName: string;
    description: string;
    timestamp: bigint;
    cardId?: bigint;
    revisionType: string;
}
export interface User {
    id: bigint;
    name: string;
    pinHash: string;
}
export interface backendInterface {
    assignCard(cardId: bigint, userId: bigint | null, actorUserId: bigint): Promise<void>;
    changeUserPin(userId: bigint, oldPinHash: string, newPinHash: string): Promise<void>;
    clearRevisions(): Promise<void>;
    createCard(title: string, description: string | null, columnId: bigint, actorUserId: bigint): Promise<bigint>;
    createColumn(name: string, actorUserId: bigint): Promise<bigint>;
    createUser(name: string, pinHash: string): Promise<bigint>;
    deleteCard(cardId: bigint, actorUserId: bigint): Promise<void>;
    deleteColumn(columnId: bigint, actorUserId: bigint): Promise<void>;
    deleteUser(id: bigint): Promise<void>;
    getCardRevisions(cardId: bigint): Promise<Array<Revision>>;
    getCards(): Promise<Array<Card>>;
    getColumns(): Promise<Array<ColumnView>>;
    getRevisions(): Promise<Array<Revision>>;
    getUsers(): Promise<Array<User>>;
    initBoard(): Promise<void>;
    moveCard(cardId: bigint, targetColumnId: bigint, newPosition: bigint, actorUserId: bigint): Promise<void>;
    renameColumn(columnId: bigint, newName: string, actorUserId: bigint): Promise<void>;
    reorderColumns(newOrder: Array<bigint>, actorUserId: bigint): Promise<void>;
    resetUserPin(userId: bigint, adminPinHash: string, newPinHash: string): Promise<void>;
    setAdminPin(newPinHash: string): Promise<void>;
    updateCard(cardId: bigint, title: string, description: string | null, actorUserId: bigint): Promise<void>;
    verifyPin(userId: bigint, pinHash: string): Promise<boolean>;
}
