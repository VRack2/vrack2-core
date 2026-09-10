import BootClass from "./BootClass";
import BasicType from "../validator/types/BasicType";
import { IContainerStructure } from "../Container";
/**
 * A boot class for storing the structure of a container.
 *
 * When a container is created, it is assigned a unique identifier.
 * This identifier is used as parameters of methods.
 *
 * @see getById
 * @see updateById
 *
 * The loader emits a single `serviceLoaded` finalization event after the
 * initial `load()` and after each hot mutation (add/remove device/connection).
 * StructureStorage reacts to it by persisting the container structure once.
 *
 * @see structureStorage
 *
 * */
export default class StructureStorage extends BootClass {
    checkOptions(): {
        [key: string]: BasicType;
    };
    process(): void;
    /**
     * Updates the structure on disk using the structure of
     * the container itself, triggered by the `serviceLoaded` event
     *
     *
     * @see StructureStorage.process
    */
    structureStorage(): Promise<void>;
    /**
     * Returns structure by container identifier
     *
     * @param id Container ID
    */
    getById(id: string): Promise<IContainerStructure>;
    /**
     * Updating the container structure
     *
     * @param id Container ID
     * @param structure updated container structure object
    */
    updateById(id: string, structure: IContainerStructure): Promise<void>;
    /**
     * Updates the display structure parameter from the file structure
     *
     * @param cStruct now container structure
     * @param structure new structure
    */
    protected updateStructure(cStruct: IContainerStructure, structure: IContainerStructure, id: string): void;
    /**
     * Forms the path to the structure file by its identifier
     *
     * @param id Container ID
    */
    protected makeFilePath(id: string): string;
}
