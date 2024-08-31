import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { OpenAI } from 'openai'
import { initPromptBuilder } from '../prompt'
import {
  ChatRequest,
  ModelConfig,
  getChatCompletion,
  respondWithJson,
} from '../openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const mkPrompt = initPromptBuilder<ModelConfig, ChatRequest>({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
})

describe('mkPrompt', async () => {
  test('request content', async () => {
    const requestContent = mkPrompt(
      `
        You are a professional AI assistant for teachers. Respond in the language {{language}}.
        Be helpful and kind, and extremely concise by answering in no more than a sentence.
      `,
      async ({ renderedTemplate, context, config }) => {
        const messages = [
          { role: 'system' as const, content: renderedTemplate },
          ...context.messages,
        ]

        return await getChatCompletion(openai, messages, config)
      },
    )

    const capital = await requestContent({
      context: {
        messages: [{ role: 'user', content: 'What is the capital of France?' }],
      },
      templateArgs: { language: 'English' },
    })

    console.log({ capital })
    expect(capital).toBeDefined()
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
      context: {
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

    console.log({ details })
    expect(details).toBeDefined()
  })
})
