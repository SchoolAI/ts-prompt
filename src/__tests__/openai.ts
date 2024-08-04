import type { ChatCompletionMessageParam as OpenAIChatCompletionMessageParam } from 'openai/resources/chat/completions'

export type {
  ChatCompletion as OpenAIChatCompletion,
  ChatCompletionCreateParams as OpenAIChatCompletionCreateParams,
  ChatCompletionMessageParam as OpenAIChatCompletionMessageParam,
  ChatCompletionToolChoiceOption as OpenAIChatCompletionToolChoiceOption,
} from 'openai/resources/chat/completions'

export type {
  ChatCompletionStream as OpenAIChatCompletionStream,
  ChatCompletionStreamParams as OpenAIChatCompletionStreamParams,
} from 'openai/lib/ChatCompletionStream'

import type { ImageGenerateParams } from 'openai/resources/images'
export type { ImageGenerateParams } from 'openai/resources/images'

export { OpenAI } from 'openai'

import { Moderation } from 'openai/resources/moderations.mjs'
import { AIClient } from './ai'
import { ChatMessage } from '../types'

export type OpenAIModerationResult = Moderation
export type OpenAIModerationCategories = keyof Moderation.Categories

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

export const generateImageUrl = async (
  ai: AIClient,
  prompt: string,
  opts?: Partial<ImageGenerateParams>,
): Promise<string> => {
  if (!opts) {
    opts = {}
  }
  if (!opts.model) {
    opts.model = 'dall-e-3'
  }
  if (!opts.size) {
    opts.size = '1024x1024'
  }
  if (!opts.n) {
    opts.n = 1
  }
  if (!opts.response_format) {
    opts.response_format = 'url'
  }
  const response = await ai.openai.images.generate({
    prompt,
    ...opts,
  })
  try {
    if (!response.data[0] || !response.data[0]!.url) {
      throw new Error('No image url found in OpenAI response')
    }
    const url = response.data[0].url
    return url
  } catch (error) {
    throw new Error('Error generating image')
  }
}
