import { Transaction } from 'node-firebird';
import { promisify } from 'util';

export default class FirebirdTransaction {
    constructor(private transaction: Transaction) {}
    async query(query: string, params: any[]): Promise<any[]> {
        const asyncQuery = promisify(this.transaction.query);
        return asyncQuery.call(this.transaction, query, params);
    }
    async execute(query: string, params: any[]): Promise<any[]> {
        const asyncExecute = promisify(this.transaction.execute);
        return asyncExecute.call(this.transaction, query, params);
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
