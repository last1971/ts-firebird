import { Transaction } from 'node-firebird';
import { promisify } from 'util';

export default class FirebirdTransaction {
    constructor(private transaction: Transaction) {}
    async query(query: string, params: any[], autoCommit = false): Promise<any[]> {
        const asyncQuery = promisify(this.transaction.query);
        try {
            const response = await asyncQuery.call(this.transaction, query, params);
            if (autoCommit) await this.commit();
            return response;
        } catch (e) {
            if (autoCommit) await this.rollback();
            throw e;
        }
    }
    async execute(query: string, params: any[], autoCommit = false): Promise<any[]> {
        const asyncExecute = promisify(this.transaction.execute);
        try {
            const response = await asyncExecute.call(this.transaction, query, params);
            if (autoCommit) await this.commit();
            return response;
        } catch (e) {
            if (autoCommit) await this.rollback();
            throw e;
        }
    }
    async commit(): Promise<void> {
        const asyncCommit = promisify(this.transaction.commit);
        await asyncCommit.call(this.transaction);
    }
    async rollback(): Promise<void> {
        const asyncRollback = promisify(this.transaction.rollback);
        await asyncRollback.call(this.transaction);
    }
}
