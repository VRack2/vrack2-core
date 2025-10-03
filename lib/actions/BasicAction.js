"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Action base class.
 * Forms settings for a new action in `fluent interface` style
*/
class BasicAction {
    constructor() {
        this.action = {
            type: 'unknown',
            requirements: {},
            returns: {},
            description: ''
        };
    }
    /**
     * Sets the requirements for incoming `Action` parameters
     * These rules will be applied every time the user invokes this action
     *
     * The method necessarily accepts an object.
     * An action method cannot accept anything other than an object
     *
     * @example
     *
     * ```ts
     * Action.global().requirements({
     *       id: Rule.number().require().default(0).description('Unique ID'),
     * })
     * ```
     * @param req Object of BasicType rules
    */
    requirements(req) {
        this.action.requirements = req;
        return this;
    }
    /**
     * Sets the requirements for the return value.
     * This method does not guarantee that this action will return this particular data type.
     * In fact, the return value is not validated.
     * It may help to read the documentation for the device
     *
     * @example
     *
     * ```ts
     * Action.global().returns({
     *       id: Rule.number().require().default(0).description('Unique ID'),
     * })
     * ```
     *
     * @param ret Object of BasicType rules
    */
    returns(ret) {
        this.action.returns = ret;
        return this;
    }
    /**
     * Set description of Action
     *
     * @example
     * ```ts
     * Action.global().description('Short action description')
     * ```
    */
    description(des) {
        this.action.description = des;
        return this;
    }
    /**
     * Returns the internal Action object.
     * This method is used inside VRack2 when processing an Action inside Container
     *
     * **Do not use this method if it is not necessary**
    */
    exportRaw() {
        return this.action;
    }
    /**
     * Forms a new IAction object
     * This method is used inside VRack2 when processing an Action inside Container
     *
     * **Do not use this method if it is not necessary**
     *
     * !hide for external users
     * @private
    */
    export() {
        const nAction = {
            type: this.action.type,
            requirements: {},
            returns: {},
            description: this.action.description,
        };
        for (const key in this.action.requirements) {
            nAction.requirements[key] = this.action.requirements[key].export();
        }
        for (const key in this.action.returns) {
            nAction.returns[key] = this.action.returns[key].export();
        }
        return nAction;
    }
}
exports.default = BasicAction;
