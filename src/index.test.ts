import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import { makeJsonRequest } from './json'
import { InferenceFn, initPromptBuilder } from './prompt'

type ModelConfig = {
  provider: 'openai'
  model: 'gpt-3.5-turbo' | 'gpt-4o'
}

const mkPrompt = initPromptBuilder<ModelConfig, Request>({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
})

type Request = { timeline: string[] }

const resultSchema = z.object({
  messages: z.number(),
  martians: z.number(),
  comment: z.string(),
})

describe('composition', async () => {
  test('createPrompt and makeJsonRequest', async () => {
    const chatCompletion: InferenceFn<ModelConfig, Request, string> = async ({
      renderedTemplate,
      context,
      config,
    }) => {
      const messages = context.timeline.length
      const martians = config.model.length
      const comment =
        renderedTemplate.split('\n')[0] +
        '! ' +
        renderedTemplate.match(/(http.*)#/)![1]
      return `{"messages": ${messages}, "martians": ${martians}, "comment": "${comment}"}`
    }

    const request = mkPrompt(
      `hello {{world}}`,
      makeJsonRequest(resultSchema, chatCompletion),
    )

    const result = await request({
      templateArgs: { world: 'earth' },
      context: { timeline: ['first message', 'second message'] },
    })

    expect(result.messages).toBe(2)
    expect(result.martians).toBe(13)
    expect(result.comment).toBe(
      'hello earth! http://json-schema.org/draft-07/schema',
    )
  })
})
