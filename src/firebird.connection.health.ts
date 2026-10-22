import { Database } from 'node-firebird';

/** Коды Firebird, означающие, что соединение больше непригодно */
const DEAD_GDS_CODES = new Set([
    335544721, // network error
    335544726, // net read error
    335544727, // net write error
    335544856, // connection shutdown
]);

const DEAD_MESSAGE = /connection (shutdown|is closed)|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up/i;

/** Ошибка от драйвера, после которой соединение надо выбросить, а не возвращать в пул */
export function isConnectionError(err: unknown): boolean {
    if (!err) return false;
    const gdscode = (err as { gdscode?: number }).gdscode;
    if (gdscode && DEAD_GDS_CODES.has(gdscode)) return true;
    const message = err instanceof Error ? err.message : String(err);
    return DEAD_MESSAGE.test(message);
}

/**
 * Помечает соединение непригодным и закрывает его. Пул node-firebird при detach
 * не возвращает в пул соединение с `_pooled === false`, а убирает его из списка —
 * следующий `get` создаст новое.
 */
export function discardConnection(nativeDb: Database): void {
    const connection = (nativeDb as unknown as { connection?: { _pooled?: boolean } }).connection;
    if (connection) connection._pooled = false;
    try {
        nativeDb.detach(() => undefined);
    } catch (e) {
        // сокет уже мёртв — detach тут и должен падать
    }
}
