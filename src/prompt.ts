import { ZodObjectDef, ZodType, ZodUndefined, z } from 'zod'
import { AIClient } from './ai'
import { ChatCompletion, ChatMessage, ChatRequest, ModelConfig } from './types'
import { createChatCompletion2 as getChatCompletion_ } from './chat'
import { Instruction, createInstruction } from './instruction'
import { IfNever, Template } from './template'
import { stringToJsonSchema } from './json'

export { Template }

// We define a variable number of arguments that each of the `request` functions can take
// (i.e. requestCompletion, requestContent, requestJson):
//   - 2 args: ai, timeline
//   - 3 args: ai, timeline, params
//
// If the prompt templat has ANY placeholders, then the request requires the third arg,
// `params`, to be passed.
type PromptRequestArgs<P extends string> = IfNever<
  P,
  [ai: AIClient, messages: ChatMessage[]],
  [ai: AIClient, messages: ChatMessage[], params: { [key in P]: string }]
>
export type BasePrompt<P extends string> = {
  requestCompletion: (...args: PromptRequestArgs<P>) => Promise<ChatCompletion>
  requestContent: (...args: PromptRequestArgs<P>) => Promise<string>
}

export type JsonPrompt<P extends string, T> = BasePrompt<P> & {
  requestJson: (...args: PromptRequestArgs<P>) => Promise<T>
}

export const createPromptWithInstruction = <
  T,
  P extends string,
  Z extends ZodType<T, ZodObjectDef>,
>(
  instruction: Instruction<P, Z>,
  joinTimeline: JoinChatMessagesFn = (systemEvent, timeline) => [
    systemEvent,
    ...timeline,
  ],
  // For tests
  getChatCompletion = getChatCompletion_,
): Z extends ZodUndefined ? BasePrompt<P> : JsonPrompt<P, z.infer<Z>> => {
  const requestCompletion = async (
    ...[ai, timeline, params]: PromptRequestArgs<P>
  ) => {
    const systemEvent: ChatMessage = {
      role: 'system',
      content: instruction.template.render(
        params as IfNever<P, undefined, { [key in P]: string }>,
      ),
    }

    const request: ChatRequest = {
      messages: joinTimeline(systemEvent, timeline),
      modelConfig: instruction.modelConfig,
    }

    return await getChatCompletion(ai, request)
  }

  const requestContent = async (...args: PromptRequestArgs<P>) => {
    const completion = await requestCompletion(...args)

    if (completion.message.role === 'assistant') {
      return completion.message.content
    } else {
      throw new Error('Expected assistant completion')
    }
  }

  const requestJson = async (
    ...args: PromptRequestArgs<P>
  ): Promise<z.infer<Z>> => {
    const content = await requestContent(...args)
    return stringToJsonSchema.pipe(instruction.returns).parse(content)
  }

  const base: BasePrompt<P> = {
    requestCompletion: requestCompletion,
    requestContent: requestContent,
  }

  return (
    instruction.returns ? { ...base, requestJson } : base
  ) as Z extends ZodUndefined ? BasePrompt<P> : JsonPrompt<P, z.infer<Z>>
}

export const createPrompt = <
  P extends string,
  Z extends ZodType<any, ZodObjectDef>,
>({
  template,
  modelConfig,
  returns,
  joinTimeline = (systemEvent, timeline) => [systemEvent, ...timeline],
  getChatCompletion = getChatCompletion_,
}: {
  template: Template<P>
  returns?: Z
  modelConfig?: ModelConfig
  joinTimeline?: JoinChatMessagesFn
  getChatCompletion?: typeof getChatCompletion_
}) => {
  const instruction = createInstruction<P, Z>({
    template,
    modelConfig,
    returns,
  })
  return createPromptWithInstruction(
    instruction,
    joinTimeline,
    getChatCompletion,
  )
}

export type JoinChatMessagesFn = (
  systemEvent: ChatMessage,
  messages: ChatMessage[],
) => ChatMessage[]
