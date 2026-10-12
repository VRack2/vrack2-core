import { Store, Table } from 'vrack2-journal-db';
import type { Row } from 'vrack2-journal-db';
import BootClass from './BootClass';
import BasicType from '../validator/types/BasicType';
/**
 * PortLogger — collects output-port traffic into a journal-db table
 * (`port_log`) so the data flows through the service ports can be queried
 * after the fact.
 *
 * Enabled by default (id `PortLogger` in `MainProcess.DEFAULT_BOOTLIST`):
 * it captures the `device.port` event — emitted by every **output** port on
 * each `push` (`{ device, data: portName, trace: data }`), unless the port
 * was marked `noCapture()`.
 *
 * Capture is switchable: the `enabled` option sets the at-start state
 * (default `true`), and the live `enable()` / `disable()` methods toggle it
 * on a running service — `disable()` only stops the writes (the journal and
 * the subscription stay, so `enable()` is instant).
 *
 * The store is rooted at `<path>/<container.id>` — the **same dir** as
 * `ServiceLogger` and `JournalDbMetrics` (each boot class owns its own table
 * in one shared store dir). An external
 * service can open the same dir with vrack2-journal-db and read the
 * `port_log` table directly (or use the `DB` / `table` / `query()` / `tail()`
 * / `count()` methods of this class).
 *
 * The store is opened with `lock: 'off'` — each boot class owns exactly one
 * table and writes are serialized by the process event loop, so the journal-db
 * inter-process `.lock` file is not needed (and would only false-positive
 * across two in-process Store instances over the same dir).
 *
 * Row: `{ ts, device, port, data }` — `port` is the output port name,
 * `data` is the pushed payload.
 *
 * Fail-soft: an append failure reports `PLG_APPEND_FAILED` on `system.error`
 * and logging continues.
 *
 * @see BootClass
 * @see ServiceLogger
 * @see https://github.com/VRack2/vrack2-journal-db
 */
export default class PortLogger extends BootClass {
    /**
     * The journal-db store (owns the `port_log` table). Created by
     * `enable()` (or in `onStart()` when the `enabled` option is `true`).
     */
    DB: Store | null;
    /**
     * The `port_log` table. Created by `enable()`.
     */
    table: Table | null;
    /**
     * Live capture state: `true` — `device.port` events are appended to the table.
     */
    enabled: boolean;
    checkOptions(): {
        [key: string]: BasicType;
    };
    onStart(): void;
    onDestroy(): Promise<void>;
    /**
     * Enable capture (idempotent, safe to call repeatedly): opens the journal
     * and subscribes to `device.port` if not done yet, then turns the capture
     * flag on.
     */
    enable(): void;
    /**
     * Disable capture: `device.port` events stop being appended, but the
     * journal and the subscription stay — `enable()` resumes instantly.
     */
    disable(): void;
    /**
     * The `port_log` table, or `PLG_NOT_STARTED` if capture has never been
     * enabled (or the boot class was already destroyed).
     */
    protected ensureTable(): Table;
    /**
     * Query the logged port traffic for a period (same period format as
     * `JournalDbMetrics.read()`).
     *
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are old → new
     * @throws PLG_NOT_STARTED if capture has never been enabled
     */
    query(period: string): {
        relevant: boolean;
        start: string;
        end: string;
        rows: Row[];
    };
    /**
     * The last `count` logged port pushes (old → new).
     *
     * @param count Number of rows (default 100)
     * @throws PLG_NOT_STARTED if capture has never been enabled
     */
    tail(count?: number): Row[];
    /**
     * Total number of logged port pushes.
     *
     * @throws PLG_NOT_STARTED if capture has never been enabled
     */
    count(): number;
    /**
     * Appends a `device.port` event to the `port_log` table while capture is
     * enabled (fail-soft: a failure reports `PLG_APPEND_FAILED` on
     * `system.error`, logging continues).
     *
     * @param nEvent `{ device, data: portName, trace: data }`
     */
    protected onPortEvent(nEvent: {
        device: string;
        data: string;
        trace: any;
    }): void;
}
