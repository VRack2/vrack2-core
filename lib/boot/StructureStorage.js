"use strict";
/*
 * Copyright © 2024 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BootClass_1 = __importDefault(require("./BootClass"));
const Rule_1 = __importDefault(require("../validator/Rule"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ImportManager_1 = __importDefault(require("../ImportManager"));
const ErrorManager_1 = __importDefault(require("../errors/ErrorManager"));
ErrorManager_1.default.register('StructureStorage', 'FKb5raEUDFgU', 'SS_STRUCT_NOT_FOUND', 'Structure ID not found', {
    id: Rule_1.default.string().require().example('vrack').description('Structure id')
});
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
class StructureStorage extends BootClass_1.default {
    checkOptions() {
        return {
            structureDir: Rule_1.default.string().require().default('./structure')
        };
    }
    process() {
        if (!(0, fs_1.existsSync)(this.options.structureDir))
            (0, fs_1.mkdirSync)(this.options.structureDir, { recursive: true });
        this.Container.on('beforeLoaded', this.beforeLoadedUpdate.bind(this));
    }
    /**
     * Updates the structure on disk using the structure of
     * the container itself when it is loaded
     *
     *
     * @see StructureStorage.process
    */
    beforeLoadedUpdate() {
        return __awaiter(this, void 0, void 0, function* () {
            const fp = this.makeFilePath(this.Container.id);
            let structure = {};
            try {
                if ((0, fs_1.existsSync)(fp))
                    structure = ImportManager_1.default.importJSON(fp);
                const cStruct = yield this.Container.getStructure();
                this.updateStructure(cStruct, structure, this.Container.id);
            }
            catch (error) {
                this.error(error);
            }
        });
    }
    /**
     * Returns structure by container identifier
     *
     * @param id Container ID
    */
    getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const fp = this.makeFilePath(id);
            if (!(0, fs_1.existsSync)(fp))
                throw ErrorManager_1.default.make('SS_STRUCT_NOT_FOUND', { id });
            return ImportManager_1.default.importJSON(fp);
        });
    }
    /**
     * Updating the container structure
     *
     * @param id Container ID
     * @param structure updated container structure object
    */
    updateById(id, structure) {
        return __awaiter(this, void 0, void 0, function* () {
            const cStruct = yield this.getById(id);
            this.updateStructure(cStruct, structure, id);
        });
    }
    /**
     * Updates the display structure parameter from the file structure
     *
     * @param cStruct now container structure
     * @param structure new structure
    */
    updateStructure(cStruct, structure, id) {
        for (const dID in cStruct) {
            if (structure[dID] && structure[dID].display)
                cStruct[dID].display = structure[dID].display;
        }
        const fp = this.makeFilePath(id);
        (0, fs_1.writeFileSync)(fp, JSON.stringify(cStruct));
    }
    /**
     * Forms the path to the structure file by its identifier
     *
     * @param id Container ID
    */
    makeFilePath(id) {
        return path_1.default.join(this.options.structureDir, id + '.json');
    }
}
exports.default = StructureStorage;
