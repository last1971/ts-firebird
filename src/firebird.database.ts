import { Database, Options, attach, create, attachOrCreate, Isolation } from 'node-firebird';
import { promisify } from 'util';
import FirebirdTransaction from './firebird.transaction';
export default class FirebirdDatabase {
    constructor(private db: Database = null) {}
    async attach(options: Options): Promise<FirebirdDatabase> {
        this.db = await promisify<Options, Database>(attach)(options);
        return this;
    }
    async create(options: Options): Promise<FirebirdDatabase> {
        this.db = await promisify(create)(options);
        return this;
    }
    async attachOrCreate(options: Options): Promise<FirebirdDatabase> {
        this.db = await promisify(attachOrCreate)(options);
        return this;
    }
    static async buildAndAttach(options: Options): Promise<FirebirdDatabase> {
        const fd: FirebirdDatabase = new FirebirdDatabase();
        return fd.attach(options);
    }
    private checkDb(): void {
        if (!this.db) throw new Error('Database is null');
    }
    private detach(): void {
        this.checkDb();
        this.db.detach();
    }
    async query(query: string, params: any[], detach = false): Promise<any[]> {
        this.checkDb();
        const asyncQuery = promisify(this.db.query);
        const res = await asyncQuery.call(this.db, query, params);
        if (detach) this.detach();
        return res;
    }
    async execute(query: string, params: any[], detach = false): Promise<any[]> {
        this.checkDb();
        const asyncExecute = promisify(this.db.execute);
        const res = await asyncExecute.call(this.db, query, params);
        if (detach) this.detach();
        return res;
    }
    async transaction(isolation: Isolation): Promise<FirebirdTransaction> {
        this.checkDb();
        const transaction = new FirebirdTransaction(this.db, isolation);
        await transaction.init();
        return transaction;
    }
}
