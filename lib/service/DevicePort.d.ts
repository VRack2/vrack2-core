import IPort from "../ports/IPort";
import DeviceConnect from "./DeviceConnect";
import Device from "./Device";
/**
 * A class to implement a device port.
 * The port can be either incoming or outgoing
*/
export default class DevicePort {
    /**
     * Whether the port has at least one connection — read-only,
     * derived from `connections` (the single source of truth).
     */
    get connected(): boolean;
    /** Port connection list. One port can have multiple connections */
    connections: Array<DeviceConnect>;
    /** Port ID */
    id: string;
    /** Port type */
    type: string;
    /**
     * Port direction: `'input'` or `'output'`.
     * Output ports emit the container `device.port` event on each `push`
     * (unless `noCapture` is set); input ports never do.
     */
    direct: 'input' | 'output';
    /**
     * Whether this output port's data flow is hidden from the container:
     * `true` → no `device.port` event on `push`. Ignored on input ports.
     */
    noCapture: boolean;
    /** Flag determines whether the port should be connected */
    required: boolean;
    /**  Ссылка на устройство владельца */
    Device: Device;
    bind: ((data: any) => {}) | null;
    /**
     * Список слушателей порта
     * Используется для захвата порта. Если какие либо данные будут проброшены
     * в порт, они будут переданы для каждого вызванного слушателя
     */
    listens: Map<number, (data: any) => void>;
    constructor(id: string, port: IPort, device: Device, direct: 'input' | 'output');
    /**
     * Adding communication to a port
    */
    addConnection(connection: DeviceConnect): void;
    /**
     * Removing communication from a port.
     * Used when a device is removed from the container
     * to disconnect all its ports cleanly.
     *
     * @param connection Connection to remove
     */
    removeConnection(connection: DeviceConnect): void;
    /**
     * Calling the incoming port when calling a connection.
     * A stopped device (running = false — derived from the Container's
     * status state 'stopped', or from the missing status record after
     * removeDevice()) does not accept data —
     * the push is dropped silently.
     * A device that is not yet started (or is still starting up inside
     * onStart()/onStartAsync()) is not stopped, so startup traffic
     * (for example command registration) flows.
    */
    push(data: any): any;
}
