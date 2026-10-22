import FirebirdTransaction from './firebird.transaction';
import { IDatabaseConnection } from './i.firebird.connection';
import { Database, Transaction } from 'node-firebird';

describe('Test FirebirdTransaction', () => {
    describe('Transaction lifecycle with connection', () => {
        let mockDb: any;
        let mockTransaction: any;
        let mockConnection: IDatabaseConnection;

        beforeEach(() => {
            mockTransaction = {
                commit: jest.fn((callback) => callback()),
                rollback: jest.fn((callback) => callback()),
                query: jest.fn(),
                execute: jest.fn(),
            };

            mockDb = {
                transaction: jest.fn((isolation, callback) => {
                    callback(null, mockTransaction);
                }),
                detach: jest.fn(),
            };

            mockConnection = {
                getDatabase: jest.fn(() => mockDb),
                detach: jest.fn(),
                onTransactionClose: jest.fn(),
            };
        });

        it('should call onTransactionClose on commit', async () => {
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();
            await tx.commit();

            expect(mockConnection.onTransactionClose).toHaveBeenCalledWith(tx);
        });

        it('should call onTransactionClose on rollback', async () => {
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();
            await tx.rollback();

            expect(mockConnection.onTransactionClose).toHaveBeenCalledWith(tx);
        });

        it('should call connection.detach when commit with detach=true', async () => {
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();
            await tx.commit(true);

            expect(mockConnection.onTransactionClose).toHaveBeenCalledWith(tx);
            expect(mockConnection.detach).toHaveBeenCalled();
        });

        it('should call connection.detach when rollback with detach=true', async () => {
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();
            await tx.rollback(true);

            expect(mockConnection.onTransactionClose).toHaveBeenCalledWith(tx);
            expect(mockConnection.detach).toHaveBeenCalled();
        });

        it('should call connection.detach when detach() is called', () => {
            const tx = new FirebirdTransaction(mockConnection);
            tx.detach();

            expect(mockConnection.detach).toHaveBeenCalled();
        });
    });

    describe('Transaction lifecycle without connection (legacy mode)', () => {
        let mockDb: any;
        let mockTransaction: any;

        beforeEach(() => {
            mockTransaction = {
                commit: jest.fn((callback) => callback()),
                rollback: jest.fn((callback) => callback()),
                query: jest.fn(),
                execute: jest.fn(),
            };

            mockDb = {
                transaction: jest.fn((isolation, callback) => {
                    callback(null, mockTransaction);
                }),
                detach: jest.fn(),
            };
        });

        it('should commit without calling onTransactionClose', async () => {
            const tx = new FirebirdTransaction(mockDb);
            await tx.init();
            await tx.commit();

            expect(mockTransaction.commit).toHaveBeenCalled();
        });

        it('should rollback without calling onTransactionClose', async () => {
            const tx = new FirebirdTransaction(mockDb);
            await tx.init();
            await tx.rollback();

            expect(mockTransaction.rollback).toHaveBeenCalled();
        });

        it('should call db.detach directly when detach() is called', () => {
            const tx = new FirebirdTransaction(mockDb);
            tx.detach();

            expect(mockDb.detach).toHaveBeenCalled();
        });

        it('should call db.detach when commit with detach=true', async () => {
            const tx = new FirebirdTransaction(mockDb);
            await tx.init();
            await tx.commit(true);

            expect(mockDb.detach).toHaveBeenCalled();
        });
    });

    describe('Transaction operations', () => {
        let mockDb: any;
        let mockTransaction: any;

        beforeEach(() => {
            mockTransaction = {
                commit: jest.fn((callback) => callback()),
                rollback: jest.fn((callback) => callback()),
                query: jest.fn((query, params, callback) => callback(null, [])),
                execute: jest.fn((query, params, callback) => callback(null, [])),
            };

            mockDb = {
                transaction: jest.fn((isolation, callback) => {
                    callback(null, mockTransaction);
                }),
                detach: jest.fn(),
            };
        });

        it('should throw error if transaction is null', async () => {
            const tx = new FirebirdTransaction(mockDb);

            await expect(tx.query('SELECT 1', [])).rejects.toThrow('Transaction is null');
        });

        it('should execute query after init', async () => {
            const tx = new FirebirdTransaction(mockDb);
            await tx.init();
            await tx.query('SELECT 1', []);

            expect(mockTransaction.query).toHaveBeenCalledWith('SELECT 1', [], expect.any(Function));
        });

        it('should auto commit on query success when autoCommit=true', async () => {
            const tx = new FirebirdTransaction(mockDb);
            await tx.init();
            await tx.query('SELECT 1', [], true);

            expect(mockTransaction.commit).toHaveBeenCalled();
        });

        it('should auto rollback on query error when autoCommit=true', async () => {
            mockTransaction.query = jest.fn((query, params, callback) => callback(new Error('Query error')));

            const tx = new FirebirdTransaction(mockDb);
            await tx.init();

            await expect(tx.query('SELECT 1', [], true)).rejects.toThrow('Query error');
            expect(mockTransaction.rollback).toHaveBeenCalled();
        });
    });

    describe('Dead connection', () => {
        let mockTransaction: any;
        let mockDb: any;
        let mockConnection: IDatabaseConnection;

        beforeEach(() => {
            mockTransaction = {
                commit: jest.fn((callback) => callback(new Error('Connection shutdown'))),
                rollback: jest.fn((callback) => callback(new Error('Connection shutdown'))),
                query: jest.fn((query, params, callback) => callback(new Error('Connection shutdown'))),
                execute: jest.fn(),
            };
            mockDb = {
                transaction: jest.fn((isolation, callback) => callback(null, mockTransaction)),
                detach: jest.fn(),
            };
            mockConnection = {
                getDatabase: jest.fn(() => mockDb),
                detach: jest.fn(),
                onTransactionClose: jest.fn(),
                discardIfDead: jest.fn(),
            };
        });

        it('should discard connection and skip rollback on network error with autoCommit', async () => {
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();

            await expect(tx.query('SELECT 1', [], true)).rejects.toThrow('Connection shutdown');
            expect(mockConnection.discardIfDead).toHaveBeenCalled();
            expect(mockConnection.onTransactionClose).toHaveBeenCalledWith(tx);
            // rollback по мёртвому сокету повис бы навсегда
            expect(mockTransaction.rollback).not.toHaveBeenCalled();
        });

        it('should discard connection when commit fails with network error', async () => {
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();

            await expect(tx.commit()).rejects.toThrow('Connection shutdown');
            expect(mockConnection.discardIfDead).toHaveBeenCalled();
        });

        it('should still rollback on ordinary query error', async () => {
            mockTransaction.query = jest.fn((query, params, callback) => callback(new Error('Query error')));
            mockTransaction.rollback = jest.fn((callback) => callback());
            const tx = new FirebirdTransaction(mockConnection);
            await tx.init();

            await expect(tx.query('SELECT 1', [], true)).rejects.toThrow('Query error');
            expect(mockConnection.discardIfDead).not.toHaveBeenCalled();
            expect(mockTransaction.rollback).toHaveBeenCalled();
        });
    });
});
