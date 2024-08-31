import { describe, test, expect } from 'vitest'
import { initPromptBuilder } from './prompt'

type ModelConfig = {
  provider: 'openai'
  model: 'gpt-3.5-turbo' | 'gpt-4o'
}

type Context = {
  value: string
}

const defaultConfig: ModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
}

const mkPrompt = initPromptBuilder<ModelConfig, Context>(defaultConfig)

describe('createPrompt', () => {
  test('without template args', async () => {
    const request = mkPrompt(`hello`, async () => null)
    expect(await request({ context: { value: '' } })).toBe(null)
  })

  test('with template args', async () => {
    const request = mkPrompt(
      `hello {{world}}`,
      async ({ renderedTemplate }) => renderedTemplate,
    )
    expect(
      await request({
        templateArgs: { world: 'earth' },
        context: { value: '' },
      }),
    ).toBe('hello earth')
  })

  test('with partial config', async () => {
    const request = mkPrompt(
      `hello`,
      async ({ config }) => `${config?.provider}/${config?.model}`,
    )
    expect(
      await request({
        context: { value: '' },
        config: { model: 'gpt-4o' },
      }),
    ).toBe('openai/gpt-4o')
  })

  test('with context', async () => {
    const request = mkPrompt(
      `hello`,
      async ({ context, config }) => `${config?.model} with ${context?.value}`,
    )
    expect(await request({ context: { value: 'context' } })).toBe(
      'gpt-3.5-turbo with context',
    )
  })

  test('returns typed result', async () => {
    type Result = { martians: number; earthlings: number }
    const request = mkPrompt(`hello`, async () => ({
      martians: 1,
      earthlings: 2,
    }))
    const result: Result = await request({ context: { value: '' } })
    expect(result).toStrictEqual({ martians: 1, earthlings: 2 })
  })
})
