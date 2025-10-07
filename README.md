# ts-firebird

A TypeScript wrapper for [node-firebird](https://github.com/hgourvest/node-firebird) with Promise support and connection pool monitoring.

## Features

- 🔄 Promise-based API (async/await)
- 📊 Connection pool with monitoring
- 🔍 Track active transactions and connections
- 🛡️ Automatic cleanup with `rollbackAllTransactions()`
- 📝 Full TypeScript support
- ✅ Comprehensive test coverage

## Installation

```bash
npm install ts-firebird
```

## Quick Start

### Basic Usage

```typescript
import { FirebirdDatabase } from 'ts-firebird';

const db = new FirebirdDatabase();
await db.attach({
    host: 'localhost',
    port: 3050,
    database: '/path/to/database.fdb',
    user: 'SYSDBA',
    password: 'masterkey'
});

// Execute query
const result = await db.query('SELECT * FROM USERS WHERE ID = ?', [1]);

// With transaction
const tx = await db.transaction();
await tx.execute('UPDATE USERS SET NAME = ? WHERE ID = ?', ['John', 1]);
await tx.commit();

db.detach();
```

### Connection Pool

```typescript
import { FirebirdPool } from 'ts-firebird';

const pool = new FirebirdPool(5, {
    host: 'localhost',
    port: 3050,
    database: '/path/to/database.fdb',
    user: 'SYSDBA',
    password: 'masterkey'
});

// Get database from pool
const db = await pool.getDatabase();
const tx = await db.transaction();
await tx.query('SELECT * FROM USERS', []);
await tx.commit(true); // auto detach

// Get statistics
console.log('Active transactions:', pool.getActiveTransactionsCount());
console.log('Active connections:', pool.getActiveConnectionsCount());
console.log('Available connections:', pool.getAvailableConnectionsCount());
console.log('Max connections:', pool.getMaxConnections());

// Cleanup hanging transactions
await pool.rollbackAllTransactions();

pool.destroy();
```

## API Reference

### FirebirdPool

#### Constructor
```typescript
new FirebirdPool(max: number, options: Options)
```

#### Methods
- `getDatabase(): Promise<FirebirdDatabase>` - Get database connection from pool
- `getTransaction(isolation?: Isolation): Promise<FirebirdTransaction>` - Get transaction directly
- `getActiveTransactionsCount(): number` - Number of uncommitted transactions
- `getActiveConnectionsCount(): number` - Number of active connections
- `getAvailableConnectionsCount(): number` - Number of available connection slots
- `getMaxConnections(): number` - Maximum pool size
- `getActiveTransactions(): FirebirdTransaction[]` - List of active transactions
- `rollbackAllTransactions(): Promise<void>` - Rollback all hanging transactions
- `destroy(): void` - Destroy pool and close all connections

### FirebirdDatabase

#### Methods
- `attach(options: Options): Promise<FirebirdDatabase>`
- `create(options: Options): Promise<FirebirdDatabase>`
- `attachOrCreate(options: Options): Promise<FirebirdDatabase>`
- `query(query: string, params: any[], detach?: boolean): Promise<any[]>`
- `execute(query: string, params: any[], detach?: boolean): Promise<any[]>`
- `transaction(isolation?: Isolation): Promise<FirebirdTransaction>`
- `detach(): void`

### FirebirdTransaction

#### Methods
- `query(query: string, params: any[], autoCommit?: boolean): Promise<any[]>`
- `execute(query: string, params: any[], autoCommit?: boolean): Promise<any[]>`
- `commit(detach?: boolean): Promise<void>`
- `rollback(detach?: boolean): Promise<void>`
- `detach(): void`

## Monitoring Hanging Connections

One of the key features is the ability to monitor and cleanup hanging transactions:

```typescript
const pool = new FirebirdPool(5, options);

// Check for hanging transactions
setInterval(() => {
    const activeCount = pool.getActiveTransactionsCount();
    const activeConns = pool.getActiveConnectionsCount();

    if (activeCount > 0) {
        console.warn(`Warning: ${activeCount} uncommitted transactions!`);
        console.warn(`Active connections: ${activeConns}/${pool.getMaxConnections()}`);

        // Optionally rollback all
        // await pool.rollbackAllTransactions();
    }
}, 60000); // Check every minute
```

## Isolation Levels

```typescript
import {
    ISOLATION_READ_UNCOMMITTED,
    ISOLATION_READ_COMMITTED,
    ISOLATION_REPEATABLE_READ,
    ISOLATION_SERIALIZABLE
} from 'ts-firebird';

const tx = await db.transaction(ISOLATION_READ_COMMITTED);
```

## Testing

```bash
npm test
```

## License

MIT

## Credits

Built on top of [node-firebird](https://github.com/hgourvest/node-firebird)
