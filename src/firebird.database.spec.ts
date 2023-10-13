import FirebirdDatabase from './firebird.database';

describe('Test FirebirdDatabase', () => {
    it('Test buildAndAttach exception', async () => {
        await expect(FirebirdDatabase.buildAndAttach({ port: 3060 })).rejects.toHaveProperty('code', 'ECONNREFUSED');
    });
    it('Test checkDb', async () => {
        const fd = new FirebirdDatabase();
        await expect(fd.query('TEST', [])).rejects.toThrow('Create or Attach Database or Pool first');
    });
});
