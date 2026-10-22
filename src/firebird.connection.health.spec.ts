import { discardConnection, isConnectionError } from './firebird.connection.health';

describe('Connection health', () => {
    describe('isConnectionError', () => {
        it.each([
            ['Connection shutdown', new Error('Connection shutdown')],
            ['Connection is closed.', new Error('Connection is closed.')],
            ['ECONNRESET', new Error('read ECONNRESET')],
            ['gdscode network error', Object.assign(new Error('x'), { gdscode: 335544721 })],
            ['gdscode attachment shutdown', Object.assign(new Error('x'), { gdscode: 335544856 })],
        ])('should detect %s', (name, err) => {
            expect(isConnectionError(err)).toBe(true);
        });

        it.each([
            ['SQL error', new Error('Dynamic SQL Error')],
            ['deadlock', Object.assign(new Error('deadlock'), { gdscode: 335544336 })],
            ['null', null],
        ])('should ignore %s', (name, err) => {
            expect(isConnectionError(err)).toBe(false);
        });
    });

    describe('discardConnection', () => {
        it('should unpool and detach', () => {
            const db: any = { connection: { _pooled: true }, detach: jest.fn() };

            discardConnection(db);

            expect(db.connection._pooled).toBe(false);
            expect(db.detach).toHaveBeenCalled();
        });

        it('should swallow detach errors on dead socket', () => {
            const db: any = {
                connection: { _pooled: true },
                detach: jest.fn(() => {
                    throw new Error('socket closed');
                }),
            };

            expect(() => discardConnection(db)).not.toThrow();
            expect(db.connection._pooled).toBe(false);
        });
    });
});
