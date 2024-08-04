import { z } from 'zod'
import { modelConfigBaseSchema } from '../types'

export interface ModelConfig extends z.infer<typeof modelConfigSchema> {}
export const modelConfigSchema = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('openai'),
      model: z.enum(['gpt-3.5-turbo']),
    })
    .merge(modelConfigBaseSchema),
])
