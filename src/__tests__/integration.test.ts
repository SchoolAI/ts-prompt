import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { OpenAI } from 'openai'
import type { ImageGenerateParams } from 'openai/resources/images.mjs'
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { initPromptBuilder } from '../prompt.js'
import {
  ChatRequest,
  respondWithImage,
  respondWithJson,
  respondWithString,
} from '../openai/index.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const mkPrompt = initPromptBuilder<
  ChatCompletionCreateParamsNonStreaming,
  ChatRequest
>({
  messages: [],
  model: 'gpt-3.5-turbo',
  stream: false,
})

describe('mkPrompt', async () => {
  test('request content', async () => {
    const requestContent = mkPrompt(
      `
        You are a professional AI assistant for teachers. Respond in the language {{language}}.
        Be helpful and kind, and extremely concise by answering with a single word or phrase.
      `,
      respondWithString(openai),
    )

    const capital = await requestContent({
      request: {
        messages: [{ role: 'user', content: 'What is the capital of France?' }],
      },
      templateArgs: { language: 'English' },
    })

    expect(capital).toBe('Paris')
  })

  test('requestJson', async () => {
    const requestJson = mkPrompt(
      `
        You are an educational consultant. Extract the course or lesson name, subject, duration,
        key topics, and target audience. If information is not available, do not make up details--
        instead, report as null (or empty array if appropriate).

        Record your findings in the natural language {{language}}.
      `,
      respondWithJson(
        openai,
        z.object({
          name: z
            .string()
            .nullable()
            .describe('The name of the course or lesson.'),
          subject: z
            .string()
            .nullable()
            .describe('The subject of the course or lesson.'),
          duration: z
            .string()
            .nullable()
            .describe('The duration of the course or lesson.'),
          keyTopics: z
            .array(z.string())
            .describe('The key topics covered in the course or lesson.'),
          targetAudience: z
            .string()
            .nullable()
            .describe('The target audience for the course or lesson.'),
        }),
      ),
    )

    const details = await requestJson({
      request: {
        messages: [
          {
            role: 'user',
            content: `
              The kindergarten class will be learning about the life cycle of a butterfly.
              The topic will cover the different stages from egg, to caterpillar, to chrysalis,
              and finally to butterfly. The lesson will include hands-on activities such as
              observing live caterpillars and creating butterfly crafts. The target audience
              for this lesson is young children aged 4-6 years old.
            `,
          },
        ],
      },
      templateArgs: { language: 'English' },
    })

    expect(details).toBeDefined()
  })
})

const mkImage = initPromptBuilder<ImageGenerateParams, string>({
  prompt: '',
  model: 'dall-e-2',
  size: '256x256',
  response_format: 'url',
})

describe('mkImage', async () => {
  test('request', async () => {
    const request = mkImage(
      `
      Create a beautiful, flat color image suitable for iconography.
      Make it in the style of '{{style}}'.
    `,
      respondWithImage(openai, 'url'),
    )

    const images = await request({
      templateArgs: { style: 'absurdism' },
      request: 'a red apple',
    })

    expect(images.length).toBe(1)
  }, 30000 /* timeout 30 seconds */)
})
