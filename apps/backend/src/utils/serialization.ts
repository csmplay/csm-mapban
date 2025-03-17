/**
 * Utility function to recursively serialize objects for JSON
 * Converts Maps and Sets to array representations
 */

// Define JSON serializable primitive types
type JSONPrimitive = string | number | boolean | null | undefined;

// Define recursive types for JSON data structures
type JSONArray = JSONValue[];
type JSONObject = { [key: string]: JSONValue };

// Define union type for all possible JSON values
type JSONValue = JSONPrimitive | JSONObject | JSONArray;

// Define the input types that can be serialized
export type Serializable =
  | JSONValue
  | Set<JSONValue>
  | Map<string | number, JSONValue>
  | { [key: string]: Serializable }
  | Serializable[]
  | undefined;

export const serializeForJSON = (obj: Serializable): JSONValue => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle Sets
  if (obj instanceof Set) {
    return Array.from(obj);
  }

  // Handle Maps
  if (obj instanceof Map) {
    return Array.from(obj.entries());
  }

  // Handle arrays - serialize each element
  if (Array.isArray(obj)) {
    return obj.map((item) => serializeForJSON(item));
  }

  // Handle objects - serialize each property
  if (typeof obj === "object") {
    const result: JSONObject = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeForJSON(obj[key]);
      }
    }
    return result;
  }

  // Primitive values are returned as is
  return obj;
};
