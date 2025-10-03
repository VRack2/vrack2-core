export default interface IStructureDevice {
    /** Device ID */
    id: string;
    /** Device type in VRack style like a 'vendor.Device' */
    type: string;
    /** Device options */
    options: {
        [key: string]: any;
    };
    /** Device connections */
    connections?: Array<string>;
}
