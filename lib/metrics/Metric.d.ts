import IvMS from "./IvMs";
import IvS from "./IvS";
import IvUs from "./IvUs";
export default class Metric {
    /**
     * Creating a new metric with minimum time unit in Seconds
    */
    static inS(): IvS;
    /**
     * Creating a new metric with minimum time unit in Milliseconds
    */
    static inMs(): IvMS;
    /**
     * Creating a new metric with minimum time unit in Microsecond
    */
    static inUs(): IvUs;
}
