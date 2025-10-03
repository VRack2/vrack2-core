/*
 * Copyright © 2022 Boris Bobylev. All rights reserved.
 * Licensed under the Apache License, Version 2.0
*/

import AnyType from "./types/AnyType";
import ArrayType from "./types/ArrayType";
import BooleanType from "./types/BooleanType";
import FunctionType from "./types/FunctionType";
import NumberType from "./types/NumberType";
import ObjectType from "./types/ObjectType";
import StringType from "./types/StringType";


export default class Rule {
    static any() {
        return new AnyType()
    }

    static number() {
        return new NumberType()
    }

    static string(){
        return new StringType()
    }

    static object(){
        return new ObjectType()
    }

    static array (){
        return new ArrayType()
    }

    static boolean (){
        return new BooleanType()
    }

    static function (){
        return new FunctionType()
    }

}
