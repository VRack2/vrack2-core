"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GlobalAction_1 = __importDefault(require("./GlobalAction"));
/**
 * A class for defining new actions.
 * It is not necessary to use `new Action`.
 * You must use the static method `Action.global` to define a new action
*/
class Action {
    /**
     * The only type of action game at the moment. Does not have any special properties.
     *
     * @see BasicAction
    */
    static global() {
        return new GlobalAction_1.default();
    }
}
exports.default = Action;
