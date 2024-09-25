/**
 *
 */
export const invalid_uuid = "00000000-0000-0000-0000-000000000000";

/**
 *
 */
export function get_attribute_default_value(type: string): unknown {
    if (type.startsWith("array")) {
        return [];
    }

    if (type.startsWith("map<")) {
        return {};
    }

    switch (type) {
        case "string":
            return "";
        case "json":
            return {};
        case "entity_ref":
            return { originalEUID: invalid_uuid, linkage: [] };
        case "uuid":
            return invalid_uuid;
        case "bool":
            return false;
        case "float":
            return 0;
    }

    if (type.endsWith("_ref")) {
        return invalid_uuid;
    }

    if (type.includes("int")) {
        return 0;
    }

    const vectorMatch = type.match(/^i?vec([2-4])$/);
    if (vectorMatch) {
        return Array.from(Array(parseInt(vectorMatch[1]))).map(() => 0);
    }

    const matrixMatch = type.match(/^mat([2-4])$/);
    if (matrixMatch) {
        const matrixSize = parseInt(matrixMatch[1]);
        const elementCount = matrixSize * matrixSize;
        const result = Array.from(Array(elementCount)).map(() => 0);
        for (let i = 0; i < matrixSize; ++i) {
            result[i * matrixSize + i] = 1;
        }
        return result;
    }

    console.warn(`Unrecognized attribute type : ${type}`);
    return undefined;
}
