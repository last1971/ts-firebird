import FirebirdDatabase from './firebird.database';
import { IFirebirdListener } from './i.firebird.listener';
import { Database } from 'node-firebird';

describe('Test FirebirdDatabase', () => {
    it('Test buildAndAttach exception', async () => {
        await expect(FirebirdDatabase.buildAndAttach({ port: 3060 })).rejects.toHaveProperty('code', 'ECONNREFUSED');
    });
    it('Test checkDb', async () => {
        const fd = new FirebirdDatabase();
        await expect(fd.query('TEST', [])).rejects.toThrow('Database is null');
    });

    describe('Listener notifications', () => {
        let mockDb: any;
        let mockListener: IFirebirdListener;

        beforeEach(() => {
            mockDb = {
                detach: jest.fn(),
                transaction: jest.fn((isolation, callback) => {
                    callback(null, {
                        commit: jest.fn((cb) => cb()),
                        rollback: jest.fn((cb) => cb()),
                    });
                }),
                query: jest.fn(),
                execute: jest.fn(),
            } as any;

            mockListener = {
                onTransactionCreated: jest.fn(),
                onTransactionClosed: jest.fn(),
                onDatabaseDetached: jest.fn(),
            } as IFirebirdListener;
        });

        it('should notify listener when transaction is created', async () => {
            const db = new FirebirdDatabase(mockDb, mockListener);
            await db.transaction();

            expect(mockListener.onTransactionCreated).toHaveBeenCalledWith(mockDb, expect.any(Object));
        });

        it('should notify listener when database is detached', () => {
            const db = new FirebirdDatabase(mockDb, mockListener);
            db.detach();

            expect(mockDb.detach).toHaveBeenCalled();
            expect(mockListener.onDatabaseDetached).toHaveBeenCalledWith(mockDb);
        });

        it('should notify listener when transaction is closed', () => {
            const db = new FirebirdDatabase(mockDb, mockListener);
            const mockTransaction = {} as any;

            db.onTransactionClose(mockTransaction);

            expect(mockListener.onTransactionClosed).toHaveBeenCalledWith(mockDb, mockTransaction);
        });

        it('should work without listener', async () => {
            const db = new FirebirdDatabase(mockDb);

            await expect(db.transaction()).resolves.toBeDefined();
            expect(() => db.detach()).not.toThrow();
        });
    });
});
