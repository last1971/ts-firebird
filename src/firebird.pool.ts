import { ConnectionPool, Isolation, ISOLATION_READ_COMMITTED, Options, pool } from 'node-firebird';
import { promisify } from 'util';
import FirebirdDatabase from './firebird.database';
import FirebirdTransaction from './firebird.transaction';

export default class FirebirdPool {
    private readonly pool: ConnectionPool;
    constructor(private max: number, private options: Options) {
        this.pool = pool(max, options);
    }

    async getDatabase(): Promise<FirebirdDatabase> {
        const asyncGet = promisify(this.pool.get);
        return new FirebirdDatabase(await asyncGet.call(this.pool));
    }

    async getTransaction(isolation: Isolation = ISOLATION_READ_COMMITTED): Promise<FirebirdTransaction> {
        const db = await this.getDatabase();
        return db.transaction(isolation);
    }

    destroy(): void {
        this.pool.destroy();
    }
}
