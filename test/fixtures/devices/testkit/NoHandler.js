/*
 * Test fixture device: declares an input port `data` but does NOT
 * implement the `inputData` handler.
 * Used to verify CTR_INPUT_HANDLER_NF during ServiceLoader.load().
 */
import { Device, Port } from 'vrack2-core'

export default class NoHandler extends Device {
    inputs() {
        return {
            data: Port.standard(),
        }
    }
}