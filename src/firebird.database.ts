import { Database, Options, attach, create, attachOrCreate, Isolation, ISOLATION_READ_COMMITTED } from 'node-firebird';
import { promisify } from 'util';
import FirebirdTransaction from './firebird.transaction';
import { IDatabaseConnection } from './i.firebird.connection';
import { IFirebirdListener } from './i.firebird.listener';
import { discardConnection, isConnectionError } from './firebird.connection.health';
export default class FirebirdDatabase implements IDatabaseConnection {
    constructor(private db: Database = null, private listener: IFirebirdListener = null) {}
    getDatabase(): Database {
        return this.db;
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
    private checkDb(): void {
        if (!this.db) throw new Error('Database is null');
    }
    public detach(): void {
        this.checkDb();
        this.db.detach();
        this.listener?.onDatabaseDetached(this.db);
    }
    /**
     * Сетевая ошибка значит, что соединение мертво: выбрасываем его из пула,
     * иначе следующий запрос по нему повиснет без ответа.
     */
    public discardIfDead(err: unknown): void {
        if (!this.db || !isConnectionError(err)) return;
        discardConnection(this.db);
        this.listener?.onDatabaseDetached(this.db);
    }
    async query(query: string, params: any[], detach = false): Promise<any[]> {
        this.checkDb();
        const asyncQuery = promisify(this.db.query);
        try {
            const res = await asyncQuery.call(this.db, query, params);
            if (detach) this.detach();
            return res;
        } catch (e) {
            this.discardIfDead(e);
            throw e;
        }
    }
    async execute(query: string, params: any[], detach = false): Promise<any[]> {
        this.checkDb();
        const asyncExecute = promisify(this.db.execute);
        try {
            const res = await asyncExecute.call(this.db, query, params);
            if (detach) this.detach();
            return res;
        } catch (e) {
            this.discardIfDead(e);
            throw e;
        }
    }
    async transaction(isolation: Isolation = ISOLATION_READ_COMMITTED): Promise<FirebirdTransaction> {
        this.checkDb();
        const transaction = new FirebirdTransaction(this, isolation);
        await transaction.init();
        this.listener?.onTransactionCreated(this.db, transaction);
        return transaction;
    }
    onTransactionClose(transaction: FirebirdTransaction): void {
        this.listener?.onTransactionClosed(this.db, transaction);
    }
}
