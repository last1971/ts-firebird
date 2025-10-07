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
                        query: jest.fn(),
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
