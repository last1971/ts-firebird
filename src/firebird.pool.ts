import { ConnectionPool, Database, Isolation, ISOLATION_READ_COMMITTED, Options, pool } from 'node-firebird';
import { promisify } from 'util';
import FirebirdDatabase from './firebird.database';
import FirebirdTransaction from './firebird.transaction';
import { IFirebirdListener } from './i.firebird.listener';
import { discardConnection } from './firebird.connection.health';

export interface PoolHealthOptions {
    /** Проверять соединение запросом `select 1 from rdb$database` перед выдачей. По умолчанию включено. */
    validate?: boolean;
    /** Сколько ждать ответа на проверку, мс. Мёртвый сокет не отвечает никогда — без таймаута зависнем. */
    validateTimeout?: number;
}

export default class FirebirdPool implements IFirebirdListener {
    private readonly pool: ConnectionPool;
    private allTransactions: Set<FirebirdTransaction> = new Set();
    private activeDatabases: Set<Database> = new Set();
    private readonly validate: boolean;
    private readonly validateTimeout: number;

    constructor(private max: number, private options: Options, health: PoolHealthOptions = {}) {
        this.pool = pool(max, options);
        this.validate = health.validate ?? true;
        this.validateTimeout = health.validateTimeout ?? 5000;
    }

    /**
     * Берёт соединение из пула. node-firebird не замечает, что сервер перезапустился:
     * соединение с мёртвым сокетом остаётся в пуле, а запрос по нему висит вечно
     * (колбэк не вызывается). Поэтому каждое выданное соединение проверяем пингом
     * с таймаутом; не ответившее выбрасываем из пула и берём следующее.
     */
    async getDatabase(): Promise<FirebirdDatabase> {
        const asyncGet = promisify(this.pool.get);
        let lastError: Error = null;
        // max + 1: все соединения пула могли умереть разом, последняя попытка — уже свежее
        for (let attempt = 0; attempt <= this.max; attempt++) {
            const nativeDb: Database = await asyncGet.call(this.pool);
            if (!this.validate || (await this.isAlive(nativeDb))) {
                return new FirebirdDatabase(nativeDb, this);
            }
            lastError = new Error('Firebird connection is dead, discarded from pool');
            discardConnection(nativeDb);
        }
        throw lastError;
    }

    private isAlive(nativeDb: Database): Promise<boolean> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), this.validateTimeout);
            try {
                nativeDb.query('select 1 from rdb$database', [], (err) => {
                    clearTimeout(timer);
                    resolve(!err);
                });
            } catch (e) {
                clearTimeout(timer);
                resolve(false);
            }
        });
    }

    async getTransaction(isolation: Isolation = ISOLATION_READ_COMMITTED): Promise<FirebirdTransaction> {
        const db = await this.getDatabase();
        return db.transaction(isolation);
    }

    // IFirebirdListener implementation
    onTransactionCreated(nativeDb: Database, transaction: FirebirdTransaction): void {
        this.allTransactions.add(transaction);
        this.activeDatabases.add(nativeDb);
    }

    onTransactionClosed(nativeDb: Database, transaction: FirebirdTransaction): void {
        this.allTransactions.delete(transaction);
    }

    onDatabaseDetached(nativeDb: Database): void {
        this.activeDatabases.delete(nativeDb);
    }

    // Statistics methods
    getActiveTransactionsCount(): number {
        return this.allTransactions.size;
    }

    getActiveTransactions(): FirebirdTransaction[] {
        return Array.from(this.allTransactions);
    }

    getActiveConnectionsCount(): number {
        return this.activeDatabases.size;
    }

    getMaxConnections(): number {
        return this.max;
    }

    getAvailableConnectionsCount(): number {
        return this.max - this.activeDatabases.size;
    }

    // Cleanup methods
    async rollbackAllTransactions(): Promise<void> {
        const errors: Error[] = [];
        for (const transaction of this.allTransactions) {
            try {
                await transaction.rollback();
            } catch (err) {
                errors.push(err instanceof Error ? err : new Error(String(err)));
            }
        }
        if (errors.length > 0) {
            throw new Error(`Rollback errors: ${errors.map((e) => e.message).join(', ')}`);
        }
    }

    destroy(): void {
        this.pool.destroy();
    }
}
