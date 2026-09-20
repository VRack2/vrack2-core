/**
 * A single channel message (alert / error) recorded in a device status.
 */
export interface IDeviceStatusMessage {
    /** The event's `data` string (for `device.terminate` — the action name) */
    data: string;
    /** The event's trace (`Error` is objectified into a plain object) */
    trace: any;
    /** Receiving time, `Date.now()` ms */
    at: number;
}
/**
 * Systematized device status — one record per registered device.
 * Maintained by the **Container** (not by the device): lifecycle transitions
 * (register / start / stop) and channel messages (`device.alert`,
 * `device.error`, `device.terminate`). A full snapshot is emitted on the
 * 'device.status' channel every time the record changes.
 *
 * @see Container.getDeviceStatus() / Container.deviceStatusList()
 */
export default interface IDeviceStatus {
    /** Device ID */
    id: string;
    /** Device type like a 'vendor.Device' */
    type: string;
    /**
     * Lifecycle state — the single source of lifecycle info in the status.
     *  - `registered` — created but not started yet (`process()` / `processPromise()` have not run);
     *  - `started` — fully running;
     *  - `stopped` — stopped by `stopDevice()` / `stopAll()`.
     * The raw booleans (`Device.running` + the Container's started set) are a
     * lossless function of this state, so they are not duplicated here.
     */
    state: 'registered' | 'started' | 'stopped';
    /** `Date.now()` of the last status change (ms) */
    since: number;
    /** Last alert message, or null if there was none */
    lastAlert: IDeviceStatusMessage | null;
    /** Last error message (`device.error` / `device.terminate`), or null if there was none */
    lastError: IDeviceStatusMessage | null;
    /** Number of alerts since registration */
    alertCount: number;
    /** Number of errors (including terminate) since registration */
    errorCount: number;
}
