/*
 * Test fixture device: records its lifecycle on the instance.
 *
 *  - input  'data'  - adds to the internal counter
 *  - output 'out'   - emits the current counter value
 *  - action 'ping'  - returns 'pong'
 *
 * Instance flags (set by the lifecycle methods, for assertions):
 *   onRegisterCount / onStartCount / onStartAsyncCount : number of calls
 *   onStopCount / onStopAsyncCount : number of stop calls
 *   order : array of lifecycle calls in order (for sequence assertions)
 *   destroyed : boolean (true once onDestroy() ran)
 *   count      : current counter value
 */
import { Device, Port, Action } from 'vrack2-core'

export default class Tracker extends Device {
    onRegister() {
        this.onRegisterCount = (this.onRegisterCount || 0) + 1
        ;(this.order = this.order || []).push('onRegister')
    }

    onStart() {
        this.onStartCount = (this.onStartCount || 0) + 1
        this.count = 0
        ;(this.order = this.order || []).push('onStart')
    }

    async onStartAsync() {
        this.onStartAsyncCount = (this.onStartAsyncCount || 0) + 1
        ;(this.order = this.order || []).push('onStartAsync')
    }

    onStop() {
        this.onStopCount = (this.onStopCount || 0) + 1
        ;(this.order = this.order || []).push('onStop')
    }

    async onStopAsync() {
        this.onStopAsyncCount = (this.onStopAsyncCount || 0) + 1
        ;(this.order = this.order || []).push('onStopAsync')
    }

    onDestroy() {
        this.destroyed = true
        ;(this.order = this.order || []).push('onDestroy')
    }

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