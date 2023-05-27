import { Database, Options, attach, create, attachOrCreate } from 'node-firebird';
import { promisify } from 'util';
export default class FirebirdDatabase {
    private db: Database;
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
        if (!this.db) throw new Error('Create or Attach Database first');
    }
    async query(query: string, params: any[]): Promise<any[]> {
        this.checkDb();
        const asyncQuery = promisify(this.db.query);
        return asyncQuery.call(this.db, query, params);
    }
    async execute(query: string, params: any[]): Promise<any[]> {
        this.checkDb();
        return promisify(this.db.execute)(query, params);
    }
}
