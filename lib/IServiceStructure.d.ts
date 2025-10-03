import IStructureDevice from "./IStructureDevice";
/** Basic service file structure */
export default interface IServiceStructure {
    /**
     * Devices list
     * @see IStructureDevice
    */
    devices: Array<IStructureDevice>;
    /**
     * Connections list
    */
    connections: Array<string>;
}
