import { OpenAI } from './openai'

export type AIClient = {
  openai: OpenAI
}

export const createAIClient = ({
  openAiApiKey,
}: {
  openAiApiKey: string
}) => {
  return {
    openai: new OpenAI({ apiKey: openAiApiKey }),
  }
}
