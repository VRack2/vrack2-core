import AnyType from "./types/AnyType";
import ArrayType from "./types/ArrayType";
import BooleanType from "./types/BooleanType";
import FunctionType from "./types/FunctionType";
import NumberType from "./types/NumberType";
import ObjectType from "./types/ObjectType";
import StringType from "./types/StringType";
export default class Rule {
    static any(): AnyType;
    static number(): NumberType;
    static string(): StringType;
    static object(): ObjectType;
    static array(): ArrayType;
    static boolean(): BooleanType;
    static function(): FunctionType;
}
