export default interface IStructureDevice {
    /** Device ID */
    id: string;
    /** Device type in VRack style like a 'vendor.Device' */
    type: string;
    /** Device options */
    options: { [key: string]: any; };
    /** Device connections */
    connections?: Array<string>
    /**
     * Declared resource publications: `{ resourceKey: registryName }`.
     * The device publishes `resourceKey` (the interface it provides) under
     * the unique registry name `registryName`, so several devices can
     * provide the same key without collision.
     */
    publish?: { [key: string]: string };
    /**
     * Declared resource requirements: `{ resourceKey: registryName }`.
     * The device resolves `resourceKey` to the exact publication
     * `registryName` declared in another device's `publish`.
     */
    resolve?: { [key: string]: string };
}
