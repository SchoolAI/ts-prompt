import { z } from 'zod'

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
      ctx.addIssue({ code: 'custom', message: 'Invalid JSON' })
      return z.NEVER
    }
  })
