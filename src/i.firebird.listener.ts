import { Database } from 'node-firebird';
import FirebirdTransaction from './firebird.transaction';

export interface IFirebirdListener {
    onTransactionCreated(nativeDb: Database, transaction: FirebirdTransaction): void;
    onTransactionClosed(nativeDb: Database, transaction: FirebirdTransaction): void;
    onDatabaseDetached(nativeDb: Database): void;
}
