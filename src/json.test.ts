import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import { makeJsonTemplateString, stringToJsonSchema } from './json.js'

describe('stringToJsonSchema', () => {
  test('Converts string to json', () => {
    const json = stringToJsonSchema.parse('{"teacher":"Maria Montessori"}')
    expect(json).toEqual({ teacher: 'Maria Montessori' })
  })

  test('Can catch on error', () => {
    const secondSchema = z.object({ name: z.string() })
    const result = stringToJsonSchema
      .pipe(secondSchema.or(z.undefined()))
      .catch(undefined)
      .parse('')
    expect(result).toBe(undefined)
  })
})

describe('makeJsonTemplateString', () => {
  test('includes schema', () => {
    const schema = z.object({ name: z.string() })
    const result = makeJsonTemplateString(schema)
    expect(result).toMatchInlineSnapshot(`
      "You must return the result as a JSON object.
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
      }"
    `)
  })
})
