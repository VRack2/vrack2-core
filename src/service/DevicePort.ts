/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import IPort from "../ports/IPort"
import DeviceConnect from "./DeviceConnect"
import Utility from "../Utility"

/**
 * A class to implement a device port. 
 * The port can be either incoming or outgoing
*/
export default class DevicePort {
    /** Flag to determine if the port is connected */
    connected = false

    /** Port connection list. One port can have multiple connections */
    connections: Array<DeviceConnect> = []

    /** Port ID */
    id: string
    /** Port type */
    type: string

    /** Flag determines whether the port should be connected */
    required: boolean

    /**
     * Список слушателей порта
     * Используется для захвата порта. Если какие либо данные будут проброшены 
     * в порт, они будут переданы для каждого вызнванного слушателя
    */
    listens = new Map<number, (data:any) => void>()

    constructor(id: string, port: IPort) {
        this.id = id
        this.type = port.type
        this.required = port.required
    }

    /**
     * Adding communication to a port
    */
    addConnection(connection: DeviceConnect) {
        this.connected = true
        this.connections.push(connection)
    }

    /**
     * Calling the incoming port when calling a connection 
    */
    push(data: any): any { 
        // Если у нас есть слушатели порта
        // Передаем им данные и пересоздаем Map
        if (this.listens.size) {
            const res = Utility.prettyFormat(data)
            for (const ls of this.listens.values()) ls(res)
            this.listens = new Map()
        }
        if (!this.connected) return
        if (this.connections.length === 1) return this.connections[0].push(data)
        for (const conn of this.connections) conn.push(data)
    }
}
