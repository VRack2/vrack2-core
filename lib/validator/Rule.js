"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AnyType_1 = __importDefault(require("./types/AnyType"));
const ArrayType_1 = __importDefault(require("./types/ArrayType"));
const BooleanType_1 = __importDefault(require("./types/BooleanType"));
const FunctionType_1 = __importDefault(require("./types/FunctionType"));
const NumberType_1 = __importDefault(require("./types/NumberType"));
const ObjectType_1 = __importDefault(require("./types/ObjectType"));
const StringType_1 = __importDefault(require("./types/StringType"));
class Rule {
    static any() {
        return new AnyType_1.default();
    }
    static number() {
        return new NumberType_1.default();
    }
    static string() {
        return new StringType_1.default();
    }
    static object() {
        return new ObjectType_1.default();
    }
    static array() {
        return new ArrayType_1.default();
    }
    static boolean() {
        return new BooleanType_1.default();
    }
    static function() {
        return new FunctionType_1.default();
    }
}
exports.default = Rule;
