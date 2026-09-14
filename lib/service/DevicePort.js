"use strict";
/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Utility_1 = __importDefault(require("../Utility"));
/**
 * A class to implement a device port.
 * The port can be either incoming or outgoing
*/
class DevicePort {
    constructor(id, port, device) {
        /** Flag to determine if the port is connected */
        this.connected = false;
        /** Port connection list. One port can have multiple connections */
        this.connections = [];
        this.bind = null;
        /**
         * Список слушателей порта
         * Используется для захвата порта. Если какие либо данные будут проброшены
         * в порт, они будут переданы для каждого вызванного слушателя
        */
        this.listens = new Map();
        this.id = id;
        this.type = port.type;
        this.required = port.required;
        this.Device = device;
    }
    /**
     * Adding communication to a port
    */
    addConnection(connection) {
        this.connected = true;
        this.connections.push(connection);
    }
    /**
     * Removing communication from a port.
     * Used when a device is removed from the container
     * to disconnect all its ports cleanly.
     *
     * @param connection Connection to remove
     */
    removeConnection(connection) {
        const idx = this.connections.indexOf(connection);
        if (idx !== -1)
            this.connections.splice(idx, 1);
        if (this.connections.length === 0)
            this.connected = false;
    }
    /**
     * Calling the incoming port when calling a connection.
     * A stopped device (running = false) does not accept data —
     * the push is dropped silently.
    */
    push(data) {
        if (!this.Device.running)
            return;
        if (this.bind !== null)
            return this.bind(data);
        // Если у нас есть слушатели порта
        // Передаем им данные и пересоздаем Map
        if (this.listens.size) {
            const res = Utility_1.default.prettyFormat(data);
            for (const ls of this.listens.values())
                ls(res);
            this.listens = new Map();
        }
        if (!this.connected)
            return;
        if (this.connections.length === 1)
            return this.connections[0].push(data);
        for (const conn of this.connections)
            conn.push(data);
    }
}
exports.default = DevicePort;
