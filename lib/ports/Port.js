"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ReturnPort_1 = __importDefault(require("./ReturnPort"));
const StandartPort_1 = __importDefault(require("./StandartPort"));
/**
 * Creating a new port. Used internally to create a port
*/
class Port {
    /**
     * Standard Port.
     * Used to cast a value to another port or to signal a value to another port
    */
    static standart() {
        return new StandartPort_1.default();
    }
    /**
     * Return Port. Used to get the value over connections
    */
    static return() {
        return new ReturnPort_1.default();
    }
}
exports.default = Port;
