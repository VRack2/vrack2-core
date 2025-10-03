import DevicePort from "./DevicePort";
/**
 * Class for connecting device ports
 * Using inside Container class
*/
export default class {
    outputLink: DevicePort;
    inputLink: DevicePort;
    /**
    */
    constructor(output: DevicePort, input: DevicePort);
    /**
     * Handles communication between two device ports
     * @param data Data sent by the device when the push port is invoked
    */
    push(data: any): any;
}
