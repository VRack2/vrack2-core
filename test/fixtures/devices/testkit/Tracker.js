/*
 * Test fixture device: records its lifecycle on the instance.
 *
 *  - input  'data'  - adds to the internal counter
 *  - output 'out'   - emits the current counter value
 *  - action 'ping'  - returns 'pong'
 *
 * Instance flags (set by the lifecycle methods, for assertions):
 *   preProcessCount / processCount / processPromiseCount : number of calls
 *   terminated : boolean (true once beforeTerminate() ran)
 *   count      : current counter value
 */
import { Device, Port, Action } from 'vrack2-core'

export default class Tracker extends Device {
    preProcess() { this.preProcessCount = (this.preProcessCount || 0) + 1 }

    process() {
        this.processCount = (this.processCount || 0) + 1
        this.count = 0
    }

    async processPromise() { this.processPromiseCount = (this.processPromiseCount || 0) + 1 }

    beforeTerminate() { this.terminated = true }

    inputs() {
        return { data: Port.standard().description('Increment input') }
    }

    outputs() {
        return { out: Port.standard().description('Current counter value') }
    }

    actions() {
        return { ping: Action.global().description('Ping') }
    }

    inputData(data) {
        const delta = typeof data === 'number' && isFinite(data) ? data : 1
        this.count += delta
        this.ports.output.out.push(this.count)
        return this.count
    }

    actionPing() { return 'pong' }
}