import ReturnPort from "./ReturnPort";
import StandartPort from "./StandartPort";
/**
 * Creating a new port. Used internally to create a port
*/
export default class Port {
    /**
     * Standard Port.
     * Used to cast a value to another port or to signal a value to another port
    */
    static standart(): StandartPort;
    /**
     * Return Port. Used to get the value over connections
    */
    static return(): ReturnPort;
}
