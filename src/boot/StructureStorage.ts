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

ErrorManager.register('StructureStorage', 'FKb5raEUDFgU', 'SS_STRUCT_NOT_FOUND', 'Structure ID not found', {
    id: Rule.string().require().example('vrack').description('Structure id')
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
 * When the container is loaded it calls “beforeLoaded”. 
 * At this point it updates the structure from disk to the structure 
 * of the container itself and writes the changes
 * 
 * @see beforeLoadedUpdate
 * 
 * */
export default class StructureStorage extends BootClass {

    checkOptions(): { [key: string]: BasicType; } {
        return {
            structureDir: Rule.string().require().default('./structure')
        }
    }

    process(): void {
        if (!existsSync(this.options.structureDir)) mkdirSync(this.options.structureDir, { recursive: true })
        this.Container.on('beforeLoaded', this.beforeLoadedUpdate.bind(this))
    }

    /**
     * Updates the structure on disk using the structure of
     * the container itself when it is loaded
     * 
     * 
     * @see StructureStorage.process
    */
    async beforeLoadedUpdate(){
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