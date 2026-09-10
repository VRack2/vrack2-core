/*
 * Test fixture device: a simple lamp.
 *
 * - input  'on'      - truthy / number > 0 turns the lamp on
 * - output 'status'  - { on, brightness } object
 * - metric 'brightness'
 * - option 'maxBrightness' (default 200)
 */
import { Device, Port, Rule, Metric } from 'vrack2-core'

export default class Lamp extends Device {
    checkOptions() {
        return {
            maxBrightness: Rule.number().integer().min(1).max(255).default(200).description('Maximum brightness'),
        }
    }

    inputs() {
        return {
            on: Port.standard().description('Turn on/off (number > 0 = on)'),
        }
    }

    outputs() {
        return {
            status: Port.standard().description('Lamp status { on, brightness }'),
        }
    }

    metrics() {
        return {
            brightness: Metric.inS().retentions('1s:6h').description('Current brightness'),
        }
    }

    process() {
        this.state = { on: false, brightness: 0 }
    }

    inputOn(data) {
        const on = typeof data === 'number' ? data > 0 : data === true
        this.state.on = on
        this.state.brightness = on ? this.options.maxBrightness : 0
        this.shares = { on: this.state.on, brightness: this.state.brightness }
        this.render()
        this.metric('brightness', this.state.brightness, 'last')
        this.ports.output.status.push(this.shares)
    }
}