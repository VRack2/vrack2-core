/*
 * Test fixture device: reads/writes the service database boot class via getDB().
 *
 * - processPromise(): `SELECT 1` through getDB() → shares.one
 * - action 'write': upsert into kv (required: k, v) inside a transaction;
 *   returns the stored value read back from the same connection
 */
import { Device, Action, Rule } from 'vrack2-core'

export default class DbReader extends Device {
    actions() {
        return {
            write: Action.global().requirements({
                k: Rule.string().required().description('Key'),
                v: Rule.number().required().description('Value'),
            }).description('Insert a kv row in the service database (transaction)'),
        }
    }

    async processPromise() {
        const db = this.getDB()
        const rows = await db.query('SELECT 1 AS one')
        this.shares.one = rows[0].one
    }

    actionWrite(data) {
        return this.getDB().transaction(async (tx) => {
            await tx.execute(
                'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
                [data.k, data.v],
            )
            const row = await tx.get('SELECT v FROM kv WHERE k = ?', [data.k])
            return row.v
        })
    }
}
