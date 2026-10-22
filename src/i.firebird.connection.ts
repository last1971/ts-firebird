import { Database } from 'node-firebird';
import FirebirdTransaction from './firebird.transaction';

export interface IDatabaseConnection {
    getDatabase(): Database;
    detach(): void;
    onTransactionClose(transaction: FirebirdTransaction): void;
    /** Выбросить соединение из пула, если ошибка сетевая. Необязателен для внешних реализаций. */
    discardIfDead?(err: unknown): void;
}
