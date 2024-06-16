import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import { createPrompt, createPromptWithInstruction } from './prompt'
import { createInstruction } from './instruction'
import { Template } from './template'
import { ChatCompletion } from './types'

const completion: ChatCompletion = {
  message: { role: 'assistant', content: '{"value": true}' },
  finishReason: 'stop',
}

const getChatCompletion = async () => completion

const ai = {} as any

describe('Prompt', () => {
  test('createPrompt that `returns` nothing has no `requestJson`', async () => {
    const prompt = createPrompt({
      template: Template.build(`hello`),
      returns: undefined,
    })

    // Can't call `getJson` if no zod schema provided as `returns`
    expect('requestJson' in prompt).toBe(false)
  })

  test('createPrompt with value returned', async () => {
    const prompt = createPrompt({
      template: Template.build(`hello`),
      returns: z.object({ value: z.boolean() }),
      getChatCompletion, // just for testing
    })

    const json = await prompt.requestJson(ai, [])
    expect(json.value).toBe(true)
  })

  test('getCompletion', () => {
    const prompt = createPromptWithInstruction(
      createInstruction({
        template: Template.build(`hello {{world}}`),
        returns: z.object({}),
      }),
      undefined,
      getChatCompletion,
    )

    expect(prompt.requestCompletion(ai, [], { world: 'there' }))
  })
})
