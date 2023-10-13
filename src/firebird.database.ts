import { Database, Options, attach, create, attachOrCreate, Isolation, pool, ConnectionPool } from 'node-firebird';
import { promisify } from 'util';
import FirebirdTransaction from './firebird.transaction';
export default class FirebirdDatabase {
    private db: Database;
    private pool: ConnectionPool;
    private async getDb(): Promise<Database> {
        if (this.db) {
            return this.db;
        }
        const get = promisify(this.pool.get);
        return get.call(this.pool);
    }
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
    static buildAndPool(sockets: number, options: Options): FirebirdDatabase {
        const fd: FirebirdDatabase = new FirebirdDatabase();
        fd.pool = pool(sockets, options);
        return fd;
    }
    private checkDb(): void {
        if (!this.db && !this.pool) throw new Error('Create or Attach Database or Pool first');
    }
    async query(query: string, params: any[]): Promise<any[]> {
        this.checkDb();
        const db = await this.getDb();
        const asyncQuery = promisify(db.query);
        return asyncQuery.call(db, query, params);
    }
    async execute(query: string, params: any[]): Promise<any[]> {
        this.checkDb();
        const db = await this.getDb();
        return promisify(db.execute)(query, params);
    }
    async transaction(isolation: Isolation): Promise<FirebirdTransaction> {
        this.checkDb();
        const db = await this.getDb();
        const asyncTransaction = promisify(db.transaction);
        return new FirebirdTransaction(await asyncTransaction.call(db, isolation));
    }
}
