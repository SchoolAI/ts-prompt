import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { unindent } from "^/unindent.ts";

const literalSchema: z.ZodUnion<
  [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]
> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

type Literal = z.infer<typeof literalSchema>;

/**
 * A JSON type that can contain strings, numbers, booleans, nulls, other JSON objects, or arrays.
 */
export type Json = Literal | { [key: string]: Json } | Json[];

/**
 * A Zod schema for the `Json` type.
 */
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);

/**
 * A utility Zod schema type that converts a string to a JSON object.
 *
 * Example usage:
 * ```ts
 * const input = `{"name": "Alice", "age": 30}`;
 * const personSchema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 * });
 * const result = stringToJsonSchema.pipe(personSchema).parse(input);
 * ```
 *
 * You can also use Zod's `.catch` to handle JSON parse errors.
 *
 * From https://github.com/JacobWeisenburger/zod_utilz (MIT License)
 */
export const stringToJsonSchema: z.ZodEffects<
  z.ZodString,
  | string
  | number
  | boolean
  | {
    [key: string]: Json;
  }
  | Json[]
  | null,
  string
> = z
  .string()
  .transform((str, ctx): z.infer<typeof jsonSchema> => {
    try {
      return JSON.parse(str);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid JSON",
        params: { input: str },
      });
      return z.NEVER;
    }
  });

/**
 * The string included in the prompt to indicate JSON should be generated in the result.
 */
export const JSON_PROMPT = "You must return the result as a JSON object.";

/**
 * The string included in the prompt to indicate a JSON schema must be adhered to.
 */
export const SCHEMA_PROMPT =
  "The result must strictly adhere to the following JSON schema:";

/**
 * Generate a JSON template string, including JSON Schema, from a Zod schema.
 */
export const makeJsonTemplateString = (
  schema: ZodType,
): string =>
  unindent(`
    ${JSON_PROMPT}
    ${SCHEMA_PROMPT}\n
  `) + JSON.stringify(zodToJsonSchema(schema), null, 2);
