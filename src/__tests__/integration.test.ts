import { describe, expect, test } from 'vitest'
import { OpenAI } from 'openai'
import { initPrompt } from '../prompt'
import { initOpenAIGetChatCompletion } from '../openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const getChatCompletion = initOpenAIGetChatCompletion(openai)

const mkPrompt = initPrompt(getChatCompletion, {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
})

describe('chat', async () => {
  test('prompt', async () => {
    const prompt1 = mkPrompt({
      template: `
        You are a professional AI assistant for teachers. Respond in the language {{language}}.
        Be helpful and kind, and extremely concise by answering in no more than a sentence.
      `,
    })

    const capital = await prompt1.requestContent({
      timeline: [{ role: 'user', content: 'What is the capital of France?' }],
      params: { language: 'English' },
    })

    expect(capital).toBeDefined()
  })
})
