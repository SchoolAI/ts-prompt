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
import { ChatMessage, chatRoleSchema } from './types'

export type OpenAIModerationResult = Moderation
export type TOpenAIModerationCategories = {
  [key in keyof Moderation.Categories]: key
}
export const OpenAIModerationCategories: TOpenAIModerationCategories = {
  harassment: 'harassment',
  'harassment/threatening': 'harassment/threatening',
  hate: 'hate',
  'hate/threatening': 'hate/threatening',
  'self-harm': 'self-harm',
  'self-harm/instructions': 'self-harm/instructions',
  'self-harm/intent': 'self-harm/intent',
  sexual: 'sexual',
  'sexual/minors': 'sexual/minors',
  violence: 'violence',
  'violence/graphic': 'violence/graphic',
} as const

export type OpenAIChatMessageRole = 'system' | 'assistant' | 'user' | 'tool'

export type OpenAIChatMessage = {
  id: string
  role: OpenAIChatMessageRole
  content: string
  name?: string
  fileNames?: string[]
  sources?: string[]
  isSummary?: boolean
  tool_call?: {
    name: string
    arguments?: any
  }
}

export const getContent = (content: string | null | undefined) => {
  if (!content) return undefined
  if (typeof content !== 'string') throw new Error('string expected')
  return content
}

const coerceMessageContentToString = (
  message?: OpenAIChatMessage,
): ChatMessage => {
  if (Array.isArray(message) || !message) throw new Error('message expected')
  return {
    ...message,
    role: chatRoleSchema.parse(message.role),
    content: getContent(message.content) || '',
  }
}

export const mapOpenAIChatMessageToChatMessage = (
  message: OpenAIChatMessage,
): ChatMessage => {
  return coerceMessageContentToString(message)
}
export const mapOpenAIChatMessagesToChatMessages = (
  messages: OpenAIChatMessage[],
): ChatMessage[] => {
  return messages.map(mapOpenAIChatMessageToChatMessage)
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

export const embedTexts = async (ai: AIClient, texts: string[]) => {
  const embedding = await ai.openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    encoding_format: 'float',
  })
  return embedding?.data
}
