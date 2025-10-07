import { ConnectionPool, Database, Isolation, ISOLATION_READ_COMMITTED, Options, pool } from 'node-firebird';
import { promisify } from 'util';
import FirebirdDatabase from './firebird.database';
import FirebirdTransaction from './firebird.transaction';
import { IFirebirdListener } from './i.firebird.listener';

export default class FirebirdPool implements IFirebirdListener {
    private readonly pool: ConnectionPool;
    private allTransactions: Set<FirebirdTransaction> = new Set();
    private activeDatabases: Set<Database> = new Set();

    constructor(private max: number, private options: Options) {
        this.pool = pool(max, options);
    }

    async getDatabase(): Promise<FirebirdDatabase> {
        const asyncGet = promisify(this.pool.get);
        const nativeDb = await asyncGet.call(this.pool);
        return new FirebirdDatabase(nativeDb, this);
    }

    async getTransaction(isolation: Isolation = ISOLATION_READ_COMMITTED): Promise<FirebirdTransaction> {
        const db = await this.getDatabase();
        return db.transaction(isolation);
    }

    // IFirebirdListener implementation
    onTransactionCreated(nativeDb: Database, transaction: FirebirdTransaction): void {
        this.allTransactions.add(transaction);
        this.activeDatabases.add(nativeDb);
    }

    onTransactionClosed(nativeDb: Database, transaction: FirebirdTransaction): void {
        this.allTransactions.delete(transaction);
    }

    onDatabaseDetached(nativeDb: Database): void {
        this.activeDatabases.delete(nativeDb);
    }

    // Statistics methods
    getActiveTransactionsCount(): number {
        return this.allTransactions.size;
    }

    getActiveTransactions(): FirebirdTransaction[] {
        return Array.from(this.allTransactions);
    }

    getActiveConnectionsCount(): number {
        return this.activeDatabases.size;
    }

    getMaxConnections(): number {
        return this.max;
    }

    getAvailableConnectionsCount(): number {
        return this.max - this.activeDatabases.size;
    }

    // Cleanup methods
    async rollbackAllTransactions(): Promise<void> {
        const errors: Error[] = [];
        for (const transaction of this.allTransactions) {
            try {
                await transaction.rollback();
            } catch (err) {
                errors.push(err instanceof Error ? err : new Error(String(err)));
            }
        }
        if (errors.length > 0) {
            throw new Error(`Rollback errors: ${errors.map((e) => e.message).join(', ')}`);
        }
    }

    destroy(): void {
        this.pool.destroy();
    }
}
