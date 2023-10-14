import { Database, Isolation, ISOLATION_READ_COMMITTED, Transaction } from 'node-firebird';
import { promisify } from 'util';

export default class FirebirdTransaction {
    private transaction: Transaction;
    constructor(private db: Database, private isolation: Isolation = ISOLATION_READ_COMMITTED) {}
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
        this.db.detach();
    }
    async commit(detach = false): Promise<void> {
        const asyncCommit = promisify(this.transaction.commit);
        await asyncCommit.call(this.transaction);
        if (detach) this.detach();
    }
    async rollback(detach = false): Promise<void> {
        const asyncRollback = promisify(this.transaction.rollback);
        await asyncRollback.call(this.transaction);
        if (detach) this.detach();
    }
}
