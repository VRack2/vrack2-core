import IStructureDevice from "./IStructureDevice";
import type { IBootListConfig } from "./Bootstrap";
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
    /**
     * Boot-class overrides for this service (optional).
     * Merged over the core defaults by `MainProcess` — an entry with `path`
     * adds or replaces a boot class, an entry without `path` overrides
     * options of an existing one, `null` removes it.
     * @see IBootListConfig
     */
    bootstrap?: IBootListConfig;
}
