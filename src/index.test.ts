import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import { makeJsonRequest } from './json'
import { createPrompt } from './prompt'

const mkPrompt = createPrompt({})

const resultSchema = z.object({
  martians: z.number(),
})

describe('composition', async () => {
  test('createPrompt and makeJsonRequest', async () => {
    const chatCompletion = async (content: string, config: any) => {
      return '{"martians": 1}'
    }

    const { request } = mkPrompt({
      template: `hello {{world}}`,
      functions: { request: makeJsonRequest(resultSchema, chatCompletion) },
    })

    const result = await request({ args: { world: 'earth' } })

    expect(result.martians).toBe(1)
  })
})
