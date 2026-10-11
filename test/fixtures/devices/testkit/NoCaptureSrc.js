/*
 * Test fixture device: two output ports.
 * - 'open'   - standard output, default (emits the container `device.port` event)
 * - 'hidden' - standard output with `.noCapture()` (its `device.port` event is suppressed)
 *
 * No inputs / actions — the tests push directly onto the output ports.
 */
import { Device, Port } from 'vrack2-core'

export default class NoCaptureSrc extends Device {
    outputs() {
        return {
            open: Port.standard().description('Visible output port (default — emits device.port)'),
            hidden: Port.standard().noCapture().description('Hidden output port (noCapture — no device.port)'),
        }
    }
}
