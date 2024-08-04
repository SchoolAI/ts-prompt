import { describe, expect, test } from 'vitest'
import { OpenAI } from 'openai'
import { GetChatCompletionFn, initPrompt } from '../prompt'
import {
  chatMessagesToOpenAIChatMessages,
  openAIChatCompletionToChatCompletion,
  responseFormatToOpenAIResponseFormat,
  ModelConfig,
} from '../openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const defaultConfig: ModelConfig = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
}

const getChatCompletion: GetChatCompletionFn<ModelConfig> = async (
  messages,
  config,
) => {
  const c = { ...defaultConfig, ...config }

  const openAiCompletion = await openai.chat.completions.create({
    messages: chatMessagesToOpenAIChatMessages(messages),
    model: c.model,
    frequency_penalty: c.frequencyPenalty,
    temperature: c.temperature,
    stop: c.stop,
    seed: c.seed,
    response_format: responseFormatToOpenAIResponseFormat(
      c.responseFormat ?? 'natural',
    ),
    top_p: c.topP,

    stream: false,
  })
  return openAIChatCompletionToChatCompletion(openAiCompletion)
}

const mkPrompt = initPrompt(getChatCompletion, defaultConfig)

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

// tools:
//   c.tools.length > 0
//     ? c.tools.map(t => ({
//         type: 'function',
//         function: {
//           name: t.name,
//           parameters: t.parameters,
//         },
//       }))
//     : undefined,
// tool_choice: request.toolChoice as OpenAIChatCompletionToolChoiceOption,
// user: request.userId,

// // The prompt project ID (originally Humanloop project ID)
// projectId: z.string().optional(),

// // If the modelConfig's template has placeholders, we need inputs to interpolate into those placeholders
// inputs: z.record(z.string()).optional(),

// // Number of tokens in the request messages
// tokens: z.number().optional(),

// // Equivalent to Humanloop's session_reference_id
// traceId: z.string().optional(),

// // Identifies where the model was called from
// source: z.enum(['space']).optional(),
