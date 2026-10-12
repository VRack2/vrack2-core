import { Store, Table } from 'vrack2-journal-db';
import type { Row } from 'vrack2-journal-db';
import IDeviceEvent from '../service/IDeviceEvent';
import BootClass from './BootClass';
import BasicType from '../validator/types/BasicType';
/**
 * ServiceLogger — collects device channel events into a journal-db table
 * (`device_log`) so the history of device activity can be queried after the
 * fact.
 *
 * Enabled by default (id `ServiceLogger` in `MainProcess.DEFAULT_BOOTLIST`):
 * it captures every device channel event — `device.terminal`, `device.notify`,
 * `device.event`, `device.alert`, `device.error`, `device.terminate` — i.e.
 * all of them except `device.render`.
 *
 * Capture is switchable: the `enabled` option sets the at-start state
 * (default `true`), and the live `enable()` / `disable()` methods toggle it
 * on a running service — `disable()` only stops the writes (the journal and
 * the subscriptions stay, so `enable()` is instant).
 *
 * The store is rooted at `<path>/<container.id>`, the same layout as
 * `JournalDbMetrics`: an external service can open the same dir with
 * vrack2-journal-db and read the `device_log` table directly (or use the
 * `DB` / `table` / `query()` / `tail()` / `count()` methods of this class).
 *
 * The store is opened with `lock: 'off'` — each boot class owns exactly one
 * table and writes are serialized by the process event loop, so the journal-db
 * inter-process `.lock` file is not needed (and would only false-positive
 * across two in-process Store instances over the same dir).
 *
 * Row: `{ ts, device, event, data, trace }`
 *
 * Fail-soft: an append failure reports `SLG_APPEND_FAILED` on `system.error`
 * and logging continues.
 *
 * @see BootClass
 * @see JournalDbMetrics
 * @see https://github.com/VRack2/vrack2-journal-db
 */
export default class ServiceLogger extends BootClass {
    /**
     * The journal-db store (owns the `device_log` table). Created by
     * `enable()` (or in `onStart()` when the `enabled` option is `true`).
     */
    DB: Store | null;
    /**
     * The `device_log` table. Created by `enable()`.
     */
    table: Table | null;
    /**
     * Live capture state: `true` — channel events are appended to the table.
     */
    enabled: boolean;
    /**
     * Channels captured by default — every device channel except `render`.
     */
    static readonly DEFAULT_CHANNELS: string[];
    checkOptions(): {
        [key: string]: BasicType;
    };
    onStart(): void;
    onDestroy(): Promise<void>;
    /**
     * Enable capture (idempotent, safe to call repeatedly): opens the journal
     * and subscribes to the channels if not done yet, then turns the capture
     * flag on.
     */
    enable(): void;
    /**
     * Disable capture: channel events stop being appended, but the journal
     * and the subscriptions stay — `enable()` resumes instantly.
     */
    disable(): void;
    /**
     * The `device_log` table, or `SLG_NOT_STARTED` if capture has never been
     * enabled (or the boot class was already destroyed).
     */
    protected ensureTable(): Table;
    /**
     * Query the logged events for a period (same period format as
     * `JournalDbMetrics.read()`).
     *
     * @param period Period in the form 'now-6h:now'
     * @returns `{ relevant, start, end, rows }` — `rows` are old → new
     * @throws SLG_NOT_STARTED if capture has never been enabled
     */
    query(period: string): {
        relevant: boolean;
        start: string;
        end: string;
        rows: Row[];
    };
    /**
     * The last `count` logged events (old → new).
     *
     * @param count Number of events (default 100)
     * @throws SLG_NOT_STARTED if capture has never been enabled
     */
    tail(count?: number): Row[];
    /**
     * Total number of logged events.
     *
     * @throws SLG_NOT_STARTED if capture has never been enabled
     */
    count(): number;
    /**
     * Appends a channel event to the `device_log` table while capture is
     * enabled (fail-soft: a failure reports `SLG_APPEND_FAILED` on
     * `system.error`, logging continues).
     *
     * @param channel Device channel
     * @param nEvent `{ device, data, trace }`
     */
    protected onChannelEvent(channel: string, nEvent: IDeviceEvent): void;
}
