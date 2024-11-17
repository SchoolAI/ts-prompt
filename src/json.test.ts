import { assertEquals } from "jsr:@std/assert@1.0.8";
import { z } from "zod";
import { makeJsonTemplateString, stringToJsonSchema } from "./json.ts";
import { unindent } from "./unindent.ts";

const { test } = Deno;

test("stringToJsonSchema - Converts string to json", () => {
  const json = stringToJsonSchema.parse('{"teacher":"Maria Montessori"}');
  assertEquals(json, { teacher: "Maria Montessori" });
});

test("stringToJsonSchema - Can catch on error", () => {
  const secondSchema = z.object({ name: z.string() });
  const result = stringToJsonSchema
    .pipe(secondSchema.or(z.undefined()))
    .catch(undefined)
    .parse("");
  assertEquals(result, undefined);
});

test("makeJsonTemplateString - includes schema", () => {
  const schema = z.object({ name: z.string() });
  const result = makeJsonTemplateString(schema);
  const expected = unindent(`
    You must return the result as a JSON object.
    The result must strictly adhere to the following JSON schema:

    {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        }
      },
      "required": [
        "name"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  `.trim());

  assertEquals(result, expected);
});
