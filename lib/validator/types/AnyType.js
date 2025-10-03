"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BasicType_1 = __importDefault(require("./BasicType"));
class AnyType extends BasicType_1.default {
    constructor() {
        super();
        this.rule.type = 'any';
    }
    /**
     * Setting the default value
    */
    default(def) {
        this.rule.default = def;
        return this;
    }
    /**
     * Method of validation of this type
     *
     * @param obj Validation object
     * @param key Key for getting value from object
    */
    validate(obj, key) {
        this.basicValidate(obj, key);
        return true;
    }
}
exports.default = AnyType;
