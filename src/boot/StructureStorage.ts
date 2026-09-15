/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import BootClass from "./BootClass";
import BasicType from "../validator/types/BasicType";
import Rule from "../validator/Rule";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import ImportManager from "../ImportManager";
import { IContainerStructure } from "../Container";
import ErrorManager from "../errors/ErrorManager";

ErrorManager.register('StructureStorage', 'SS_STRUCT_NOT_FOUND', 'Structure ID not found', {
    id: Rule.string().required().example('vrack').description('Structure id')
})
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

    checkOptions(): { [key: string]: BasicType; } {
        return {
            structureDir: Rule.string().required().default('./structure')
        }
    }

    process(): void {
        if (!existsSync(this.options.structureDir)) mkdirSync(this.options.structureDir, { recursive: true })
        // Persist structure once on loader finalization (initial load + each hot mutation)
        this.Container.on('serviceLoaded', this.structureStorage.bind(this))
    }

    /**
     * Updates the structure on disk using the structure of
     * the container itself, triggered by the `serviceLoaded` event
     * 
     * 
     * @see StructureStorage.process
    */
    async structureStorage(){
        const fp = this.makeFilePath(this.Container.id)
        let structure: IContainerStructure = {}
        try {
            if (existsSync(fp)) structure = ImportManager.importJSON(fp)
            const cStruct =  await this.Container.getStructure()
            this.updateStructure(cStruct,structure, this.Container.id)
        } catch (error) { this.error(error as Error) }
    }

    /**
     * Returns structure by container identifier
     * 
     * @param id Container ID
    */
    async getById(id: string): Promise<IContainerStructure>{
        const fp = this.makeFilePath(id)
        if (!existsSync(fp)) throw ErrorManager.make('SS_STRUCT_NOT_FOUND', { id })
        return ImportManager.importJSON(fp)
    }

    /**
     * Updating the container structure
     * 
     * @param id Container ID 
     * @param structure updated container structure object
    */
    async updateById(id: string, structure: IContainerStructure){
        const cStruct =  await this.getById(id)
        this.updateStructure(cStruct, structure, id)
    }

    /**
     * Updates the display structure parameter from the file structure
     * 
     * @param cStruct now container structure
     * @param structure new structure
    */
    protected updateStructure(cStruct: IContainerStructure,structure: IContainerStructure, id: string) {
        for (const dID in cStruct) {
            if (structure[dID] && structure[dID].display) cStruct[dID].display = structure[dID].display
        }
        const fp = this.makeFilePath(id)
        writeFileSync(fp, JSON.stringify(cStruct))
    }

    /**
     * Forms the path to the structure file by its identifier
     *  
     * @param id Container ID 
    */
    protected makeFilePath(id: string) {
        return path.join(this.options.structureDir, id + '.json')
    }
}