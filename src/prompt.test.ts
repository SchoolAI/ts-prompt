import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import { initPrompt, createPromptWithInstruction } from './prompt'
import { createInstruction } from './instruction'
import { Template } from './template'
import { ChatCompletion } from './types'
import { ModelConfig } from './openai'

const defaultConfig: ModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
}

const completion: ChatCompletion = {
  message: { role: 'assistant', content: '{"value": true}' },
  finishReason: 'stop',
}

const getChatCompletion = async () => completion

const mkPrompt = initPrompt(getChatCompletion, defaultConfig)

describe('Prompt', () => {
  test('createPrompt that `returns` nothing has no `requestJson`', async () => {
    const prompt = mkPrompt({
      template: `hello`,
      returns: undefined,
    })

    // Can't call `getJson` if no zod schema provided as `returns`
    expect('requestJson' in prompt).toBe(false)
  })

  test('createPrompt with value returned', async () => {
    const prompt = mkPrompt({
      template: `hello`,
      returns: z.object({ value: z.boolean() }),
    })

    const json = await prompt.requestJson({ timeline: [] })
    expect(json.value).toBe(true)
  })

  test('createPrompt with placeholder', async () => {
    const prompt = mkPrompt({
      template: `hello {{target}}`,
      returns: z.object({ value: z.boolean() }),
    })

    const json = await prompt.requestJson({
      timeline: [],
      params: { target: 'world' },
    })
    expect(json.value).toBe(true)
  })

  test('getCompletion', () => {
    const prompt = createPromptWithInstruction(
      createInstruction({
        config: defaultConfig,
        template: Template.build(`hello {{target}}`),
        returns: z.object({}),
      }),
      undefined,
      getChatCompletion,
    )

    expect(
      prompt.requestCompletion({ timeline: [], params: { target: 'there' } }),
    )
  })
})