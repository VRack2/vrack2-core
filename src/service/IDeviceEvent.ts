export default interface IDeviceEvent {
    /** Device ID */
    device: string;
    /** event data string */
    data: string;
    /** additional information */
    trace: any;
}
