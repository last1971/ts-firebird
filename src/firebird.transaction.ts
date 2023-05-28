import { Transaction } from 'node-firebird';
import { promisify } from 'util';

export default class FirebirdTransaction {
    constructor(private transaction: Transaction) {}
    async query(query: string, params: any[]): Promise<any[]> {
        const asyncQuery = promisify(this.transaction.query);
        return asyncQuery.call(this.transaction, query, params);
    }
    async execute(query: string, params: any[]): Promise<any[]> {
        return promisify(this.transaction.execute)(query, params);
    }
    async commit(): Promise<void> {
        await promisify(this.transaction.commit)();
    }
    async rollback(): Promise<void> {
        await promisify(this.transaction.rollback)();
    }
}
