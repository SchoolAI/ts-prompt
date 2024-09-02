import { describe, test, expect } from 'vitest'
import { initPromptBuilder } from './prompt'

type ModelConfig = {
  provider: 'openai'
  model: 'gpt-3.5-turbo' | 'gpt-4o'
}

type Request = {
  value: string
}

const defaultConfig: ModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
}

const mkPrompt = initPromptBuilder<ModelConfig, Request>(defaultConfig)

describe('createPrompt', () => {
  test('without template args', async () => {
    const request = mkPrompt(`hello`, async () => null)
    expect(await request({ request: { value: '' } })).toBe(null)
  })

  test('with template args', async () => {
    const request = mkPrompt(
      `hello {{world}}`,
      async ({ renderedTemplate }) => renderedTemplate,
    )
    expect(
      await request({
        templateArgs: { world: 'earth' },
        request: { value: '' },
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
        request: { value: '' },
        config: { model: 'gpt-4o' },
      }),
    ).toBe('openai/gpt-4o')
  })

  test('with request', async () => {
    const request = mkPrompt(
      `hello`,
      async ({ request, config }) => `${config?.model} with ${request?.value}`,
    )
    expect(await request({ request: { value: 'context' } })).toBe(
      'gpt-3.5-turbo with context',
    )
  })

  test('returns typed result', async () => {
    type Result = { martians: number; earthlings: number }
    const request = mkPrompt(`hello`, async () => ({
      martians: 1,
      earthlings: 2,
    }))
    const result: Result = await request({ request: { value: '' } })
    expect(result).toStrictEqual({ martians: 1, earthlings: 2 })
  })
})
