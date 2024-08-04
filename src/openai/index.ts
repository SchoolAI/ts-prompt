import { z } from 'zod'
import { modelConfigBaseSchema } from '../types'

import type {
  ChatCompletion as OpenAIChatCompletion,
  ChatCompletionMessageParam as OpenAIChatCompletionMessageParam,
} from 'openai/resources/chat/completions'

export interface ModelConfig extends z.infer<typeof modelConfigSchema> {}
export const modelConfigSchema = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('openai'),
      model: z.enum(['gpt-3.5-turbo']),
    })
    .merge(modelConfigBaseSchema),
])

// export type {
//   ChatCompletion as OpenAIChatCompletion,
//   ChatCompletionCreateParams as OpenAIChatCompletionCreateParams,
//   ChatCompletionMessageParam as OpenAIChatCompletionMessageParam,
//   ChatCompletionToolChoiceOption as OpenAIChatCompletionToolChoiceOption,
// } from 'openai/resources/chat/completions'

// export type {
//   ChatCompletionStream as OpenAIChatCompletionStream,
//   ChatCompletionStreamParams as OpenAIChatCompletionStreamParams,
// } from 'openai/lib/ChatCompletionStream'

// export type { ImageGenerateParams } from 'openai/resources/images'

// export { OpenAI } from 'openai'

// import { Moderation } from 'openai/resources/moderations.mjs'
import { ChatCompletion, ChatMessage } from '../types'

// export type OpenAIModerationResult = Moderation
// export type OpenAIModerationCategories = keyof Moderation.Categories

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
