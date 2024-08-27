import { describe, test, expect } from 'vitest'
import { createPrompt } from './prompt'

type ModelConfig = {
  provider: 'openai'
  model: 'gpt-3.5-turbo' | 'gpt-4o'
}

const defaultConfig: ModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
}

const mkPrompt = createPrompt<ModelConfig>(defaultConfig)

describe('createPrompt', () => {
  test('without template params', async () => {
    const { request } = mkPrompt({
      template: `hello`,
      functions: { request: async () => null },
    })
    expect(await request()).toBe(null)
  })

  test('with template params', async () => {
    const { request } = mkPrompt({
      template: `hello {{world}}`,
      functions: { request: async () => 'greetings' },
    })
    expect(await request({ world: 'earth' })).toBe('greetings')
  })

  test('with partial config', async () => {
    const { request } = mkPrompt({
      template: `hello`,
      functions: { request: async () => null },
    })
    expect(await request({ model: 'gpt-4o' })).toBe(null)
  })

  test('returns typed result', async () => {
    type Result = { martians: number; earthlings: number }
    const { request } = mkPrompt({
      template: `hello`,
      functions: { request: async () => ({ martians: 1, earthlings: 2 }) },
    })
    const result: Result = await request()
    expect(result).toStrictEqual({ martians: 1, earthlings: 2 })
  })
})
