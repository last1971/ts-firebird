import { Database } from 'node-firebird';
import FirebirdTransaction from './firebird.transaction';

export interface IDatabaseConnection {
    getDatabase(): Database;
    detach(): void;
    onTransactionClose(transaction: FirebirdTransaction): void;
}
