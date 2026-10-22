import FirebirdPool from './firebird.pool';
import FirebirdDatabase from './firebird.database';
import FirebirdTransaction from './firebird.transaction';

describe('Test FirebirdPool', () => {
    describe('Listener functionality', () => {
        let mockPool: any;
        let pool: FirebirdPool;

        beforeEach(() => {
            mockPool = {
                get: jest.fn((callback) => {
                    const mockDb = {
                        transaction: jest.fn((isolation, cb) => {
                            cb(null, {
                                commit: jest.fn((cb) => cb()),
                                rollback: jest.fn((cb) => cb()),
                            });
                        }),
                        detach: jest.fn(),
                        query: jest.fn((q, p, cb) => cb(null, [{ 1: 1 }])),
                        execute: jest.fn(),
                    };
                    callback(null, mockDb);
                }),
                destroy: jest.fn(),
            };

            // Mock the pool function from node-firebird
            jest.mock('node-firebird', () => ({
                pool: jest.fn(() => mockPool),
            }));

            pool = new FirebirdPool(5, { database: 'test.fdb' });
            (pool as any).pool = mockPool;
        });

        it('should track transactions when created', async () => {
            const db = await pool.getDatabase();
            const tx = await db.transaction();

            expect(pool.getActiveTransactionsCount()).toBe(1);
            expect(pool.getActiveConnectionsCount()).toBe(1);
        });

        it('should untrack transactions when committed', async () => {
            const db = await pool.getDatabase();
            const tx = await db.transaction();

            expect(pool.getActiveTransactionsCount()).toBe(1);

            await tx.commit();

            expect(pool.getActiveTransactionsCount()).toBe(0);
        });

        it('should untrack transactions when rolled back', async () => {
            const db = await pool.getDatabase();
            const tx = await db.transaction();

            expect(pool.getActiveTransactionsCount()).toBe(1);

            await tx.rollback();

            expect(pool.getActiveTransactionsCount()).toBe(0);
        });

        it('should untrack database when detached', async () => {
            const db = await pool.getDatabase();
            const tx = await db.transaction();

            expect(pool.getActiveConnectionsCount()).toBe(1);

            await tx.commit();
            db.detach();

            expect(pool.getActiveConnectionsCount()).toBe(0);
        });

        it('should track multiple transactions', async () => {
            const db1 = await pool.getDatabase();
            const tx1 = await db1.transaction();

            const db2 = await pool.getDatabase();
            const tx2 = await db2.transaction();

            expect(pool.getActiveTransactionsCount()).toBe(2);
            expect(pool.getActiveConnectionsCount()).toBe(2);
        });

        it('should return list of active transactions', async () => {
            const db = await pool.getDatabase();
            const tx = await db.transaction();

            const transactions = pool.getActiveTransactions();

            expect(transactions).toHaveLength(1);
            expect(transactions[0]).toBe(tx);
        });
    });

    describe('Statistics methods', () => {
        let pool: FirebirdPool;

        beforeEach(() => {
            pool = new FirebirdPool(10, { database: 'test.fdb' });
        });

        it('should return max connections', () => {
            expect(pool.getMaxConnections()).toBe(10);
        });

        it('should calculate available connections', async () => {
            const mockPool = {
                get: jest.fn((callback) => {
                    callback(null, {
                        transaction: jest.fn((isolation, cb) => {
                            cb(null, {
                                commit: jest.fn((cb) => cb()),
                                rollback: jest.fn((cb) => cb()),
                            });
                        }),
                        detach: jest.fn(),
                        query: jest.fn((q, p, cb) => cb(null, [{ 1: 1 }])),
                    });
                }),
                destroy: jest.fn(),
            };
            (pool as any).pool = mockPool;

            expect(pool.getAvailableConnectionsCount()).toBe(10);

            const db = await pool.getDatabase();
            await db.transaction(); // Need to create transaction to track connection
            expect(pool.getAvailableConnectionsCount()).toBe(9);
        });

        it('should return zero active transactions initially', () => {
            expect(pool.getActiveTransactionsCount()).toBe(0);
            expect(pool.getActiveTransactions()).toEqual([]);
        });
    });

    describe('Rollback all transactions', () => {
        let mockPool: any;
        let pool: FirebirdPool;

        beforeEach(() => {
            mockPool = {
                get: jest.fn((callback) => {
                    const mockDb = {
                        transaction: jest.fn((isolation, cb) => {
                            cb(null, {
                                commit: jest.fn((cb) => cb()),
                                rollback: jest.fn((cb) => cb()),
                            });
                        }),
                        detach: jest.fn(),
                        query: jest.fn((q, p, cb) => cb(null, [{ 1: 1 }])),
                    };
                    callback(null, mockDb);
                }),
                destroy: jest.fn(),
            };

            pool = new FirebirdPool(5, { database: 'test.fdb' });
            (pool as any).pool = mockPool;
        });

        it('should rollback all active transactions', async () => {
            const db1 = await pool.getDatabase();
            const tx1 = await db1.transaction();

            const db2 = await pool.getDatabase();
            const tx2 = await db2.transaction();

            expect(pool.getActiveTransactionsCount()).toBe(2);

            await pool.rollbackAllTransactions();

            expect(pool.getActiveTransactionsCount()).toBe(0);
        });

        it('should handle errors during rollback', async () => {
            const mockDb = {
                transaction: jest.fn((isolation, cb) => {
                    cb(null, {
                        commit: jest.fn((cb) => cb()),
                        rollback: jest.fn((cb) => cb(new Error('Rollback failed'))),
                    });
                }),
                detach: jest.fn(),
                query: jest.fn((q, p, cb) => cb(null, [{ 1: 1 }])),
            };

            mockPool.get = jest.fn((callback) => callback(null, mockDb));

            const db = await pool.getDatabase();
            const tx = await db.transaction();

            await expect(pool.rollbackAllTransactions()).rejects.toThrow('Rollback errors: Rollback failed');
        });

        it('should not fail if no transactions to rollback', async () => {
            await expect(pool.rollbackAllTransactions()).resolves.not.toThrow();
        });
    });

    describe('Dead connection handling', () => {
        // живое соединение отвечает на пинг, мёртвое — никогда (как сокет после рестарта сервера)
        const aliveDb = () => ({
            connection: { _pooled: true },
            detach: jest.fn(),
            query: jest.fn((q, p, cb) => cb(null, [{ 1: 1 }])),
            transaction: jest.fn((isolation, cb) =>
                cb(null, { commit: jest.fn((cb) => cb()), rollback: jest.fn((cb) => cb()) }),
            ),
        });
        const deadDb = () => ({ connection: { _pooled: true }, detach: jest.fn(), query: jest.fn() });
        const failingDb = () => ({
            connection: { _pooled: true },
            detach: jest.fn(),
            query: jest.fn((q, p, cb) => cb(new Error('Connection shutdown'))),
        });

        const poolWith = (dbs: any[], max = 5) => {
            const pool = new FirebirdPool(max, { database: 'test.fdb' }, { validateTimeout: 50 });
            (pool as any).pool = {
                get: jest.fn((callback) => callback(null, dbs.shift())),
                destroy: jest.fn(),
            };
            return pool;
        };

        it('should discard connection that never answers the ping and take the next one', async () => {
            const dead = deadDb();
            const alive = aliveDb();
            const pool = poolWith([dead, alive]);

            const db = await pool.getDatabase();

            expect(db.getDatabase()).toBe(alive);
            expect(dead.connection._pooled).toBe(false);
            expect(dead.detach).toHaveBeenCalled();
        });

        it('should discard connection whose ping fails with an error', async () => {
            const failing = failingDb();
            const alive = aliveDb();
            const pool = poolWith([failing, alive]);

            const db = await pool.getDatabase();

            expect(db.getDatabase()).toBe(alive);
            expect(failing.connection._pooled).toBe(false);
        });

        it('should give up after max + 1 dead connections', async () => {
            const dbs = [deadDb(), deadDb(), deadDb()];
            const pool = poolWith(dbs, 2);

            await expect(pool.getDatabase()).rejects.toThrow('Firebird connection is dead');
            expect((pool as any).pool.get).toHaveBeenCalledTimes(3);
        });

        it('should not ping when validation is disabled', async () => {
            const dead = deadDb();
            const pool = new FirebirdPool(5, { database: 'test.fdb' }, { validate: false });
            (pool as any).pool = { get: jest.fn((callback) => callback(null, dead)), destroy: jest.fn() };

            const db = await pool.getDatabase();

            expect(db.getDatabase()).toBe(dead);
            expect(dead.query).not.toHaveBeenCalled();
        });
    });

    describe('Pool lifecycle', () => {
        let pool: FirebirdPool;

        beforeEach(() => {
            pool = new FirebirdPool(5, { database: 'test.fdb' });
        });

        it('should create pool with correct max connections', () => {
            expect(pool.getMaxConnections()).toBe(5);
        });

        it('should destroy pool', () => {
            const mockDestroy = jest.fn();
            (pool as any).pool.destroy = mockDestroy;

            pool.destroy();

            expect(mockDestroy).toHaveBeenCalled();
        });
    });
});
