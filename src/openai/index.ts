import { ZodSchema, z } from 'zod'

import type { OpenAI } from 'openai'

import type {
  ChatCompletion as OpenAIChatCompletion,
  ChatCompletionMessageParam as OpenAIChatCompletionMessageParam,
} from 'openai/resources/chat/completions'

import { makeJsonTemplateString, stringToJsonSchema } from '../json'
import { ChatCompletion, ChatMessage } from '../types'

export type ChatRequest = {
  messages: ChatMessage[]
}

export interface ModelConfig extends z.infer<typeof modelConfigSchema> {}
export const modelConfigSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('openai'),
    model: z.enum(['gpt-3.5-turbo']),
    frequencyPenalty: z.number().optional(),
    temperature: z.number().optional(),
    stop: z.enum(['stop', 'length', 'content_filter', 'tool_calls']).optional(),
    seed: z.number().optional(),
    responseFormat: z.enum(['natural', 'json']).optional(),
    topP: z.number().optional(),
  }),
])

export const getChatCompletion = async (
  openai: OpenAI,
  messages: ChatMessage[],
  config: ModelConfig,
) => {
  const completion = await openai.chat.completions.create({
    messages: chatMessagesToOpenAIChatMessages(messages),
    model: config.model,
    frequency_penalty: config.frequencyPenalty,
    temperature: config.temperature,
    stop: config.stop,
    seed: config.seed,
    response_format: { type: 'text' as const },
    top_p: config.topP,
    stream: false,
  })

  return openAIChatCompletionToChatCompletion(completion)
}

type OpenAIInferenceParams = {
  renderedTemplate: string
  context: ChatRequest
  config: ModelConfig
}

export const respondWithJson =
  (openai: OpenAI, schema: ZodSchema) =>
  async ({ renderedTemplate, context, config }: OpenAIInferenceParams) => {
    const renderedWithJsonInstructions =
      renderedTemplate + '\n' + makeJsonTemplateString(schema)

    const messages = [
      { role: 'system' as const, content: renderedWithJsonInstructions },
      ...context.messages,
    ]

    const result = await getChatCompletion(openai, messages, config)

    return stringToJsonSchema.pipe(schema).parse(result.message.content)
  }

export const respondWithCompletion =
  (openai: OpenAI) =>
  async ({ renderedTemplate, context, config }: OpenAIInferenceParams) => {
    const messages = [
      { role: 'system' as const, content: renderedTemplate },
      ...context.messages,
    ]

    return await getChatCompletion(openai, messages, config)
  }

export const responseFormatToOpenAIResponseFormat = (
  responseFormat: 'natural' | 'json',
) => {
  switch (responseFormat) {
    case 'natural':
      return { type: 'text' as const }
    case 'json':
      return { type: 'json_object' as const }
    default:
      throw new Error(`Invalid response format: ${responseFormat}`)
  }
}

export const openAIChatMessageToChatMessage = (
  message: OpenAIChatCompletionMessageParam,
): ChatMessage => {
  const role = message.role
  switch (role) {
    case 'system':
      return {
        role: 'system',
        content: message.content,
        name: message.name,
      }

    case 'assistant':
      return {
        role: 'assistant',
        content: message.content ?? '',
        name: message.name,
      }

    case 'user':
      return {
        role: 'user',
        content: typeof message.content === 'string' ? message.content : '',
        name: message.name,
      }

    case 'tool':
      return {
        role: 'tool',
        toolCallId: message.tool_call_id,
      }

    default:
      throw new Error(`Invalid role: ${role}`)
  }
}

export const openAIChatMessagesToChatMessages = (
  messages: OpenAIChatCompletionMessageParam[],
): ChatMessage[] => {
  return messages.map(openAIChatMessageToChatMessage)
}

export const chatMessageToOpenAIChatMessage = (
  message: ChatMessage,
): OpenAIChatCompletionMessageParam => {
  switch (message.role) {
    case 'system':
      return {
        role: 'system' as const,
        name: message.name,
        content: message.content,
      }
    case 'user':
      return {
        role: 'user' as const,
        name: message.name,
        content: message.content,
      }
    case 'assistant':
      return {
        role: 'assistant' as const,
        name: message.name,
        content: message.content,
        tool_calls: message.toolCalls?.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      }
    case 'tool':
      if (!message.toolCallId)
        throw new Error('toolCallId is required for tool messages')
      return {
        role: 'tool' as const,
        content: message.content ?? '',
        tool_call_id: message.toolCallId,
      }
  }
}

export const chatMessagesToOpenAIChatMessages = (
  messages: ChatMessage[],
): OpenAIChatCompletionMessageParam[] => {
  return messages.map(chatMessageToOpenAIChatMessage)
}

export const openAIChatCompletionToChatCompletion = (
  chatCompletion: OpenAIChatCompletion,
): ChatCompletion => {
  const firstChoice = chatCompletion.choices[0]

  if (!firstChoice) {
    throw new Error('No chat completion choices')
  }

  return {
    message: {
      role: firstChoice.message.role, // always "assistant" according to OpenAI docs
      content: firstChoice.message.content ?? '',
      toolCalls: firstChoice.message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
    },
    finishReason:
      firstChoice.finish_reason === 'function_call'
        ? 'stop'
        : firstChoice.finish_reason,
    tokens: chatCompletion.usage?.total_tokens,
  }
}

// export const generateImageUrl = async (
//   ai: AIClient,
//   prompt: string,
//   opts?: Partial<ImageGenerateParams>,
// ): Promise<string> => {
//   if (!opts) {
//     opts = {}
//   }
//   if (!opts.model) {
//     opts.model = 'dall-e-3'
//   }
//   if (!opts.size) {
//     opts.size = '1024x1024'
//   }
//   if (!opts.n) {
//     opts.n = 1
//   }
//   if (!opts.response_format) {
//     opts.response_format = 'url'
//   }
//   const response = await ai.openai.images.generate({
//     prompt,
//     ...opts,
//   })
//   try {
//     if (!response.data[0] || !response.data[0]!.url) {
//       throw new Error('No image url found in OpenAI response')
//     }
//     const url = response.data[0].url
//     return url
//   } catch (error) {
//     throw new Error('Error generating image')
//   }
// }
