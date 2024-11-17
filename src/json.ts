import { z, type ZodType } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { unindent } from "./unindent.ts";

const literalSchema: z.ZodUnion<
  [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]
> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export type Literal = z.infer<typeof literalSchema>;

export type Json = Literal | { [key: string]: Json } | Json[];

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);

// From https://github.com/JacobWeisenburger/zod_utilz (MIT License)
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

export const JSON_PROMPT = "You must return the result as a JSON object.";

export const SCHEMA_PROMPT =
  "The result must strictly adhere to the following JSON schema:";

export const zodToJsonSchema = (
  schema: ZodType,
): Record<string, unknown> | undefined =>
  zodResponseFormat(schema, "result").json_schema
    .schema;

export const makeJsonTemplateString = (
  schema: ZodType,
): string =>
  unindent(`
    ${JSON_PROMPT}
    ${SCHEMA_PROMPT}\n
  `) + JSON.stringify(zodToJsonSchema(schema), null, 2);
