import { z, ZodSchema, ZodType } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { unindent } from './unindent'
import { InferenceFn } from './prompt'

export const literalSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

export type Literal = z.infer<typeof literalSchema>

export type Json = Literal | { [key: string]: Json } | Json[]

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
)

// From https://github.com/JacobWeisenburger/zod_utilz (MIT License)
export const stringToJsonSchema = z
  .string()
  .transform((str, ctx): z.infer<typeof jsonSchema> => {
    try {
      return JSON.parse(str)
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid JSON',
        params: { input: str },
      })
      return z.NEVER
    }
  })

export const makeJsonTemplateString = (schema: ZodType<any, any>) =>
  unindent(`
    You must return the result as a JSON object. The result must strictly adhere to
    the following JSON schema:\n
  `) + JSON.stringify(zodToJsonSchema(schema), null, 2)

export const makeJsonRequest =
  <C, X>(
    schema: ZodSchema,
    infer: InferenceFn<C, X, string>,
  ): InferenceFn<C, X, z.infer<typeof schema>> =>
  async ({ context, config, renderedTemplate }) => {
    const renderedWithJsonInstructions =
      renderedTemplate + '\n' + makeJsonTemplateString(schema)

    const result = await infer({
      renderedTemplate: renderedWithJsonInstructions,
      context,
      config,
    })

    return stringToJsonSchema.pipe(schema).parse(result)
  }
