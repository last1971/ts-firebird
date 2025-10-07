import { Database, Isolation, ISOLATION_READ_COMMITTED, Transaction } from 'node-firebird';
import { promisify } from 'util';
import { IDatabaseConnection } from './i.firebird.connection';

export default class FirebirdTransaction {
    private transaction: Transaction;
    private db: Database;
    private connection: IDatabaseConnection = null;
    private isolation: Isolation = ISOLATION_READ_COMMITTED;
    constructor(db: Database, isolation?: Isolation);
    constructor(connection: IDatabaseConnection, isolation?: Isolation);
    constructor(dbOrConnection: Database | IDatabaseConnection, isolation: Isolation = ISOLATION_READ_COMMITTED) {
        this.isolation = isolation;

        if ('getDatabase' in dbOrConnection) {
            // Это IDatabaseConnection
            this.connection = dbOrConnection as IDatabaseConnection;
            this.db = this.connection.getDatabase();
        } else {
            // Это Database
            this.db = dbOrConnection as Database;
        }
    }

    async init(): Promise<void> {
        const asyncTransaction = promisify(this.db.transaction);
        this.transaction = await asyncTransaction.call(this.db, this.isolation);
    }
    checkTransaction(): void {
        if (!this.transaction) throw new Error('Transaction is null');
    }
    async query(query: string, params: any[], autoCommit = false): Promise<any[]> {
        this.checkTransaction();
        const asyncQuery = promisify(this.transaction.query);
        try {
            const response = await asyncQuery.call(this.transaction, query, params);
            if (autoCommit) await this.commit(true);
            return response;
        } catch (e) {
            if (autoCommit) await this.rollback(true);
            throw e;
        }
    }
    async execute(query: string, params: any[], autoCommit = false): Promise<any[]> {
        this.checkTransaction();
        const asyncExecute = promisify(this.transaction.execute);
        try {
            const response = await asyncExecute.call(this.transaction, query, params);
            if (autoCommit) await this.commit(true);
            return response;
        } catch (e) {
            if (autoCommit) await this.rollback(true);
            throw e;
        }
    }
    detach(): void {
        if (this.connection) {
            this.connection.detach();
        } else {
            this.db.detach();
        }
    }
    async commit(detach = false): Promise<void> {
        const asyncCommit = promisify(this.transaction.commit);
        await asyncCommit.call(this.transaction);
        this.onTransactionClose(detach);
    }
    async rollback(detach = false): Promise<void> {
        const asyncRollback = promisify(this.transaction.rollback);
        await asyncRollback.call(this.transaction);
        this.onTransactionClose(detach);
    }
    onTransactionClose(detach: boolean): void {
        if (this.connection) {
            this.connection.onTransactionClose(this);
        }
        if (detach) this.detach();
    }
}
