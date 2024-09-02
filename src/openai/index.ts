import { ZodSchema, z } from 'zod'

import type { OpenAI } from 'openai'

import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'

import { makeJsonTemplateString, stringToJsonSchema } from '../json'
import { ImageGenerateParams } from 'openai/resources/images.mjs'

export type ChatRequest = {
  messages: ChatCompletionMessageParam[]
}

export const getImageInference = async (
  openai: OpenAI,
  prompt: string,
  config: ImageGenerateParams,
): Promise<(string | undefined)[]> => {
  const response = await openai.images.generate({ ...config, prompt })

  if (config.response_format === 'url') {
    return response.data.map(d => d.url)
  } else if (config.response_format === 'b64_json') {
    return response.data.map(d => d.b64_json)
  }

  return []
}

export type OpenAIInferenceParams = {
  renderedTemplate: string
  context: ChatRequest
  config: ChatCompletionCreateParamsNonStreaming
}

const $respondWithCompletion = async (
  openai: OpenAI,
  { renderedTemplate, context, config }: OpenAIInferenceParams,
) => {
  const messages = [
    { role: 'system' as const, content: renderedTemplate },
    ...context.messages,
  ]

  const result = await openai.chat.completions.create({ ...config, messages })

  const firstChoice = result.choices[0]
  if (!firstChoice) throw new Error('no completion results')

  return firstChoice
}

export const respondWithImageUrl =  (openai: OpenAI) =>
  async ({
    renderedTemplate,
    context,
    config,
  }: {
    renderedTemplate: string
    context: string
    config: ImageGenerateParams
  }) => {
    const description = renderedTemplate + context

    return await getImageInference(openai, description, config)
  },

export const respondWithCompletion =
  (openai: OpenAI) =>
  async ({ renderedTemplate, context, config }: OpenAIInferenceParams) =>
    await $respondWithCompletion(openai, { renderedTemplate, context, config })

export const respondWithString =
  (openai: OpenAI) => async (params: OpenAIInferenceParams) =>
    (await $respondWithCompletion(openai, params)).message.content

export const respondWithJson =
  (openai: OpenAI, schema: ZodSchema) =>
  async ({ renderedTemplate, context, config }: OpenAIInferenceParams) => {
    const renderedWithJsonInstructions =
      renderedTemplate + '\n' + makeJsonTemplateString(schema)

    const completion = await $respondWithCompletion(openai, {
      renderedTemplate: renderedWithJsonInstructions,
      context,
      config,
    })

    return stringToJsonSchema.pipe(schema).parse(completion.message.content)
  }
