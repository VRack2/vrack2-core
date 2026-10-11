/*
 * Test fixture device: emits a device channel event on input.
 *
 * - input  'data'  - channel name ('terminal' | 'notify' | 'event' | 'alert' | 'error')
 * - output 'out'   - echoes the emitted channel name
 */
import { Device, Port } from 'vrack2-core'

export default class Talker extends Device {
    inputs() {
        return { data: Port.standard().description('Channel name') }
    }

    outputs() {
        return { out: Port.standard().description('Emitted channel name') }
    }

    inputData(data) {
        const channel = typeof data === 'string' ? data : 'notify'
        this[channel](channel + '-message', { source: 'talker' })
        this.ports.output.out.push(channel)
        return channel
    }
}
