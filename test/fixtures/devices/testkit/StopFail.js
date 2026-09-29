/*
 * Test fixture device: its `onStop()` hook throws synchronously.
 *
 * Used to verify best-effort stop aggregation
 * (Container.stopAll() / MainProcess.stop()).
 */
import { Device, Port, Action } from 'vrack2-core'

export default class StopFail extends Device {
    onStopCalled = false

    onStop() {
        this.onStopCalled = true
        throw new Error('stop-boom')
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
        this.count = (this.count || 0) + delta
        this.ports.output.out.push(this.count)
        return this.count
    }

    actionPing() { return 'pong' }
}