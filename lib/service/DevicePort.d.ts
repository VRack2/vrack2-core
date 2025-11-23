import IPort from "../ports/IPort";
import DeviceConnect from "./DeviceConnect";
import Device from "./Device";
/**
 * A class to implement a device port.
 * The port can be either incoming or outgoing
*/
export default class DevicePort {
    /** Flag to determine if the port is connected */
    connected: boolean;
    /** Port connection list. One port can have multiple connections */
    connections: Array<DeviceConnect>;
    /** Port ID */
    id: string;
    /** Port type */
    type: string;
    /** Flag determines whether the port should be connected */
    required: boolean;
    /**  Ссылка на устройсто владельца */
    Device: Device;
    /**
     * Список слушателей порта
     * Используется для захвата порта. Если какие либо данные будут проброшены
     * в порт, они будут переданы для каждого вызнванного слушателя
    */
    listens: Map<number, (data: any) => void>;
    constructor(id: string, port: IPort, device: Device);
    /**
     * Adding communication to a port
    */
    addConnection(connection: DeviceConnect): void;
    /**
     * Calling the incoming port when calling a connection
    */
    push(data: any): any;
}
