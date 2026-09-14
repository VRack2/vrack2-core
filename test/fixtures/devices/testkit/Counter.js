/*
 * Test fixture device: a simple counter.
 *
 * - input  'data'    - tick (number)
 * - output 'result'  - current counter value
 * - action 'reset'   - reset to zero
 * - action 'set.value' - set the value directly (required: value)
 * - metric 'count'  - current counter value
 * - option 'scale'  - multiplier for every tick (default 1)
 */
import { Device, Port, Action, Rule, Metric } from 'vrack2-core'

export default class Counter extends Device {
    checkOptions() {
        return {
            scale: Rule.number().integer().min(1).default(1).description('Multiplier for every tick'),
        }
    }

    metrics() {
        return {
            count: Metric.inS().retentions('1s:6h').description('Current counter value'),
        }
    }

    inputs() {
        return {
            data: Port.standard().description('Tick input'),
        }
    }

    outputs() {
        return {
            result: Port.standard().description('Current counter value'),
        }
    }

    actions() {
        return {
            reset: Action.global().description('Reset counter to zero'),
            'set.value': Action.global()
                .requirements({
                    value: Rule.number().required().description('New counter value'),
                })
                .description('Set the counter value directly'),
        }
    }

    process() {
        this.count = this.storage.count ?? 0
        this.shares.count = this.count
    }

    inputData(data) {
        const delta = typeof data === 'number' && isFinite(data) ? data : 1
        this.count += delta * this.options.scale
        this.storage.count = this.count
        this.shares.count = this.count
        this.render()
        this.save()
        this.metric('count', this.count, 'max')
        this.ports.output.result.push(this.count)
    }

    actionReset() {
        this.count = 0
        this.storage.count = 0
        this.shares.count = 0
        this.render()
        this.save()
        this.ports.output.result.push(this.count)
        return this.count
    }

    actionSetValue(data) {
        this.count = data.value
        this.storage.count = this.count
        this.shares.count = this.count
        this.render()
        this.save()
        this.ports.output.result.push(this.count)
        return this.count
    }
}