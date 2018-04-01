(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./Date", "./DateOffset", "./List", "./List", "./Map", "./Map", "./Option", "./Reflection", "./Seq", "./Set", "./Set", "./String", "./Symbol", "./Symbol", "./Util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    // tslint:disable:ban-types
    const Date_1 = require("./Date");
    const DateOffset_1 = require("./DateOffset");
    const List_1 = require("./List");
    const List_2 = require("./List");
    const Map_1 = require("./Map");
    const Map_2 = require("./Map");
    const Option_1 = require("./Option");
    const Reflection_1 = require("./Reflection");
    const Seq_1 = require("./Seq");
    const Set_1 = require("./Set");
    const Set_2 = require("./Set");
    const String_1 = require("./String");
    const Symbol_1 = require("./Symbol");
    const Symbol_2 = require("./Symbol");
    const Util_1 = require("./Util");
    function isDate(v) {
        return v instanceof Date;
    }
    function deflateDate(v) {
        return Date_1.toString(v, "O");
    }
    function deflateValue(v) {
        if (isDate(v)) {
            return deflateDate(v);
        }
        return v;
    }
    function deflate(v) {
        if (Array.isArray(v)) {
            return v.map(deflateValue);
        }
        else if (ArrayBuffer.isView(v)) {
            return Array.from(v).map(deflateValue);
        }
        else if (isDate(v)) {
            return deflateDate(v);
        }
        else if (v != null && typeof v === "object") {
            if (v instanceof List_1.default || v instanceof Set_1.default || v instanceof Set) {
                return Array.from(v).map(deflateValue);
            }
            else if (v instanceof Map_2.default || v instanceof Map) {
                let stringKeys = null;
                return Seq_1.fold((o, kv) => {
                    if (stringKeys === null) {
                        stringKeys = typeof kv[0] === "string";
                    }
                    o[stringKeys ? kv[0] : toJson(kv[0])] = deflateValue(kv[1]);
                    return o;
                }, {}, v);
            }
            else if (v instanceof Option_1.Some) {
                return deflateValue(v.value);
            }
            const reflectionInfo = typeof v[Symbol_2.default.reflection] === "function" ? v[Symbol_2.default.reflection]() : {};
            if (reflectionInfo.properties) {
                return Seq_1.fold((o, prop) => {
                    return o[prop] = deflateValue(v[prop]), o;
                }, {}, Object.getOwnPropertyNames(reflectionInfo.properties));
            }
            else if (reflectionInfo.cases) {
                const caseInfo = reflectionInfo.cases[v.tag];
                const caseName = caseInfo[0];
                const fieldsLength = caseInfo.length - 1;
                if (fieldsLength === 0) {
                    return caseName;
                }
                else {
                    // Prevent undefined assignment from removing case property; see #611:
                    return { [caseName]: (v.data !== void 0 ? deflate(v.data) : null) };
                }
            }
            else {
                return Seq_1.fold((o, prop) => {
                    return o[prop] = deflateValue(v[prop]), o;
                }, {}, Object.getOwnPropertyNames(v));
            }
        }
        return v;
    }
    exports.deflate = deflate;
    function toJson(o) {
        return JSON.stringify(deflateValue(o), (k, v) => deflate(v));
    }
    exports.toJson = toJson;
    function combine(path1, path2) {
        return typeof path2 === "number"
            ? path1 + "[" + path2 + "]"
            : (path1 ? path1 + "." : "") + path2;
    }
    function isNullable(typ) {
        if (typeof typ === "string") {
            return typ !== "boolean" && typ !== "number";
        }
        else if (typ instanceof Util_1.NonDeclaredType) {
            return typ.kind !== "Array" && typ.kind !== "Tuple";
        }
        else {
            const info = typeof typ.prototype[Symbol_2.default.reflection] === "function"
                ? typ.prototype[Symbol_2.default.reflection]() : null;
            return info ? info.nullable : true;
        }
    }
    function invalidate(val, typ, path) {
        const str = String_1.toText(String_1.printf("%A"))(val);
        throw new Error(`${str} ${path ? "(" + path + ")" : ""} is not of type ${Reflection_1.getTypeFullName(typ)}`);
    }
    function needsInflate(enclosing) {
        const typ = enclosing.head;
        if (typeof typ === "string") {
            return false;
        }
        if (typ instanceof Util_1.NonDeclaredType) {
            switch (typ.kind) {
                case "Option":
                case "Array":
                    return typ.definition != null || needsInflate(new List_1.default(typ.generics[0], enclosing));
                case "Tuple":
                    return typ.generics.some((x) => needsInflate(new List_1.default(x, enclosing)));
                case "Function":
                    return false;
                case "GenericParam":
                    return needsInflate(Reflection_1.resolveGeneric(typ.definition, enclosing.tail));
                case "GenericType":
                    return true;
                default:
                    return false;
            }
        }
        return true;
    }
    function inflateArray(arr, enclosing, path) {
        if (!Array.isArray) {
            invalidate(arr, "array", path);
        }
        // TODO: Validate non-inflated elements
        return needsInflate(enclosing)
            ? arr.map((x, i) => inflate(x, enclosing, combine(path, i)))
            : arr;
    }
    function inflateMap(obj, keyEnclosing, valEnclosing, path) {
        const inflateKey = keyEnclosing.head !== "string";
        const inflateVal = needsInflate(valEnclosing);
        return Object
            .getOwnPropertyNames(obj)
            .map((k) => {
            const key = inflateKey ? inflate(JSON.parse(k), keyEnclosing, combine(path, k)) : k;
            const val = inflateVal ? inflate(obj[k], valEnclosing, combine(path, k)) : obj[k];
            return [key, val];
        });
    }
    function inflateList(val, enclosing, path) {
        const ar = [];
        let li = new List_1.default();
        let cur = val;
        const inf = needsInflate(enclosing);
        while (cur.tail != null) {
            ar.push(inf ? inflate(cur.head, enclosing, path) : cur.head);
            cur = cur.tail;
        }
        ar.reverse();
        for (const a of ar) {
            li = new List_1.default(a, li);
        }
        return li;
    }
    function inflateUnion(val, typ, info, path, inflateField) {
        let caseName;
        // Same shape as runtime DUs, for example, if they've been serialized with `JSON.stringify`
        if (typeof val.tag === "number") {
            return Object.assign(new typ(), val);
        }
        else if (typeof val === "string") {
            // Cases without fields are serialized as strings by `toJson`
            caseName = val;
        }
        else {
            // Non-empty cases are serialized as `{ "MyCase": [1, 2] }` by `toJson`
            caseName = Object.getOwnPropertyNames(val)[0];
        }
        // Locate case index
        let tag = -1;
        for (let i = 0; info.cases[i] != null; i++) {
            if (info.cases[i][0] === caseName) {
                tag = i;
                break;
            }
        }
        // Validate
        if (tag === -1) {
            invalidate(val, typ, path);
        }
        const caseInfo = info.cases[tag];
        let inflatedData = void 0;
        if (caseInfo.length > 2) {
            inflatedData = [];
            const data = val[caseName];
            path = combine(path, caseName);
            for (let i = 0; i < data.length; i++) {
                inflatedData.push(inflateField
                    ? inflateField(data[i], caseInfo[i + 1], combine(path, i))
                    : data[i]);
            }
        }
        else if (caseInfo.length > 1) {
            inflatedData = inflateField
                ? inflateField(val[caseName], caseInfo[1], combine(path, caseName))
                : val[caseName];
        }
        return new typ(tag, inflatedData);
    }
    function inflate(val, typ, path) {
        let enclosing = null;
        if (typ instanceof List_1.default) {
            enclosing = typ;
            typ = typ.head;
        }
        else {
            enclosing = new List_1.default(typ, new List_1.default());
        }
        if (val == null) {
            if (!isNullable(typ)) {
                invalidate(val, typ, path);
            }
            return val;
        }
        else if (typeof typ === "string") {
            if ((typ === "boolean" || typ === "number" || typ === "string") && (typeof val !== typ)) {
                invalidate(val, typ, path);
            }
            return val;
        }
        else if (typ instanceof Util_1.NonDeclaredType) {
            switch (typ.kind) {
                case "Unit":
                    return null;
                case "Option":
                    return inflate(val, new List_1.default(typ.generics[0], enclosing), path);
                case "Array":
                    if (typ.definition != null) {
                        return new typ.definition(val);
                    }
                    else {
                        return inflateArray(val, new List_1.default(typ.generics[0], enclosing), path);
                    }
                case "Tuple":
                    return typ.generics.map((x, i) => inflate(val[i], new List_1.default(x, enclosing), combine(path, i)));
                case "Function":
                    return val;
                case "GenericParam":
                    return inflate(val, Reflection_1.resolveGeneric(typ.definition, enclosing.tail), path);
                case "GenericType":
                    const def = typ.definition;
                    if (def === List_1.default) {
                        return Array.isArray(val)
                            ? List_2.ofArray(inflateArray(val, Reflection_1.resolveGeneric(0, enclosing), path))
                            : inflateList(val, Reflection_1.resolveGeneric(0, enclosing), path);
                    }
                    // TODO: Should we try to inflate also sets and maps serialized with `JSON.stringify`?
                    if (def === Set_1.default) {
                        return Set_2.create(inflateArray(val, Reflection_1.resolveGeneric(0, enclosing), path));
                    }
                    if (def === Set) {
                        return new Set(inflateArray(val, Reflection_1.resolveGeneric(0, enclosing), path));
                    }
                    if (def === Map_2.default) {
                        return Map_1.create(inflateMap(val, Reflection_1.resolveGeneric(0, enclosing), Reflection_1.resolveGeneric(1, enclosing), path));
                    }
                    if (def === Map) {
                        return new Map(inflateMap(val, Reflection_1.resolveGeneric(0, enclosing), Reflection_1.resolveGeneric(1, enclosing), path));
                    }
                    return inflate(val, new List_1.default(typ.definition, enclosing), path);
                case "Interface":
                    return typ.definition === "System.DateTimeOffset"
                        ? DateOffset_1.parse(val) : val;
                default:// case "Interface": // case "Any":
                    return val;
            }
        }
        else if (typeof typ === "function") {
            if (typ === Date) {
                return Date_1.parse(val, true);
            }
            if (typeof typ.ofJSON === "function") {
                return typ.ofJSON(val);
            }
            const info = typeof typ.prototype[Symbol_2.default.reflection] === "function" ?
                typ.prototype[Symbol_2.default.reflection]() : {};
            // Union types
            if (info.cases) {
                return inflateUnion(val, typ, info, path, (fi, t, p) => inflate(fi, new List_1.default(t, enclosing), path));
            }
            if (info.properties) {
                const newObj = new typ();
                const properties = info.properties;
                const ks = Object.getOwnPropertyNames(properties);
                for (const k of ks) {
                    newObj[k] = inflate(val[k], new List_1.default(properties[k], enclosing), combine(path, k));
                }
                return newObj;
            }
            return val;
        }
        throw new Error("Unexpected type when deserializing JSON: " + typ);
    }
    function inflatePublic(val, genArgs) {
        return inflate(val, genArgs ? genArgs.T : null, "");
    }
    exports.inflate = inflatePublic;
    function ofJson(json, genArgs) {
        function raise(msg, err, json, targetType) {
            let fullMsg = "Cannot deserialize";
            if (targetType != null) {
                fullMsg += " into " + Reflection_1.getTypeFullName(targetType);
            }
            fullMsg += " - Error (" + msg + "): " + err.message + " - Data: '" + json + "'";
            throw new Error(fullMsg);
        }
        let value = null;
        const targetType = genArgs ? genArgs.T : null;
        try {
            value = JSON.parse(json);
        }
        catch (e) {
            raise("JSON.parse", e, json, targetType);
        }
        try {
            value = inflate(value, targetType, "");
        }
        catch (e) {
            raise("inflate", e, json, targetType);
        }
        return value;
    }
    exports.ofJson = ofJson;
    // TODO: Dates and types with `toJSON` are not adding the $type field
    function toJsonWithTypeInfo(val) {
        return JSON.stringify(val, (k, v) => {
            if (ArrayBuffer.isView(v)) {
                return Array.from(v);
            }
            else if (v != null && typeof v === "object") {
                const info = typeof v[Symbol_2.default.reflection] === "function" ? v[Symbol_2.default.reflection]() : {};
                if (v instanceof List_1.default || v instanceof Set_1.default || v instanceof Set) {
                    return {
                        $type: info.type || "System.Collections.Generic.HashSet",
                        $values: Array.from(v),
                    };
                }
                else if (v instanceof Map_2.default || v instanceof Map) {
                    return Seq_1.fold((o, kv) => { o[kv[0]] = kv[1]; return o; }, { $type: info.type || "System.Collections.Generic.Dictionary" }, v);
                }
                else if (info.properties) {
                    return Seq_1.fold((o, prop) => {
                        return o[prop] = v[prop], o;
                    }, { $type: info.type }, Object.getOwnPropertyNames(info.properties));
                }
                else if (info.cases) {
                    const uci = info.cases[v.tag];
                    return {
                        // Prevent undefined assignment from removing case property; see #611:
                        [uci[0]]: (v.data !== void 0 ? v.data : null),
                        $type: info.type,
                    };
                }
            }
            return v;
        });
    }
    exports.toJsonWithTypeInfo = toJsonWithTypeInfo;
    function ofJsonWithTypeInfo(json, genArgs) {
        const parsed = JSON.parse(json, (key, v) => {
            if (v == null) {
                return v;
            }
            else if (typeof v === "object" && typeof v.$type === "string") {
                // Remove generic args and assembly info added by Newtonsoft.Json
                let type = v.$type.replace("+", ".");
                let i = type.indexOf("`");
                delete v.$type;
                if (i > -1) {
                    type = type.substr(0, i);
                }
                else {
                    i = type.indexOf(",");
                    type = i > -1 ? type.substr(0, i) : type;
                }
                if (type === "System.Collections.Generic.List" || (type.indexOf("[]") === type.length - 2)) {
                    return v.$values;
                }
                if (type === "Microsoft.FSharp.Collections.FSharpList") {
                    return List_2.ofArray(v.$values);
                }
                else if (type === "Microsoft.FSharp.Collections.FSharpSet") {
                    return Set_2.create(v.$values);
                }
                else if (type === "System.Collections.Generic.HashSet") {
                    return new Set(v.$values);
                }
                else if (type === "Microsoft.FSharp.Collections.FSharpMap") {
                    return Map_1.create(Object.getOwnPropertyNames(v)
                        .map((k) => [k, v[k]]));
                }
                else if (type === "System.Collections.Generic.Dictionary") {
                    return new Map(Object.getOwnPropertyNames(v)
                        .map((k) => [k, v[k]]));
                }
                else {
                    const typ = Symbol_1.getType(type);
                    if (typ) {
                        if (typeof typ.ofJSON === "function") {
                            return typ.ofJSON(v);
                        }
                        const info = typeof typ.prototype[Symbol_2.default.reflection] === "function" ?
                            typ.prototype[Symbol_2.default.reflection]() : {};
                        if (info.cases) {
                            return inflateUnion(v, typ, info, key);
                        }
                        return Object.assign(new typ(), v);
                    }
                }
            }
            else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)$/.test(v)) {
                return Date_1.parse(v, true);
            }
            else {
                return v;
            }
        });
        const expected = genArgs ? genArgs.T : null;
        if (parsed != null && typeof expected === "function"
            && !(parsed instanceof Util_1.getDefinition(expected))) {
            throw new Error("JSON is not of type " + expected.name + ": " + json);
        }
        return parsed;
    }
    exports.ofJsonWithTypeInfo = ofJsonWithTypeInfo;
});
