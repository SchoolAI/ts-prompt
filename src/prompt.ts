import { ZodObjectDef, ZodType, ZodUndefined, z } from 'zod'
import {
  ChatCompletion,
  ChatMessage,
  ChatRequest,
  ModelConfigBase,
} from './types'
import { IfNever, Template } from './template'
import { Instruction, createInstruction } from './instruction'
import { stringToJsonSchema } from './json'

// We define a variable number of arguments that each of the `request` functions can take
// (i.e. requestCompletion, requestContent, requestJson):
//   - 2 args: ai, timeline
//   - 3 args: ai, timeline, params
//
// If the prompt templat has ANY placeholders, then the request requires the third arg,
// `params`, to be passed.
type PromptRequestArgs<P extends string, AIClient> = IfNever<
  P,
  [ai: AIClient, timeline: ChatMessage[]],
  [ai: AIClient, timeline: ChatMessage[], params: { [key in P]: string }]
>
export type BasePrompt<P extends string, AIClient> = {
  requestCompletion: (
    ...args: PromptRequestArgs<P, AIClient>
  ) => Promise<ChatCompletion>
  requestContent: (...args: PromptRequestArgs<P, AIClient>) => Promise<string>
}

export type JsonPrompt<P extends string, T, AIClient> = BasePrompt<
  P,
  AIClient
> & {
  requestJson: (...args: PromptRequestArgs<P, AIClient>) => Promise<T>
}

export const createPromptWithInstruction = <
  T,
  P extends string,
  M extends ModelConfigBase,
  Z extends ZodType<T, ZodObjectDef>,
  AIClient,
>(
  instruction: Instruction<P, M, Z>,
  joinTimeline: JoinTimelineFn = (systemEvent, timeline) => [
    systemEvent,
    ...timeline,
  ],
  getChatCompletion: (
    ai: AIClient,
    request: ChatRequest<M>,
  ) => Promise<ChatCompletion>,
): Z extends ZodUndefined
  ? BasePrompt<P, AIClient>
  : JsonPrompt<P, z.infer<Z>, AIClient> => {
  const requestCompletion = async (
    ...[ai, timeline, params]: PromptRequestArgs<P, AIClient>
  ) => {
    const systemEvent: ChatMessage = {
      role: 'system',
      content: instruction.template.render(
        params as IfNever<P, undefined, { [key in P]: string }>,
      ),
    }

    const request: ChatRequest<M> = {
      messages: joinTimeline(systemEvent, timeline),
      config: instruction.config,
      responseFormat: 'natural',
    }

    return await getChatCompletion(ai, request)
  }

  const requestContent = async (...args: PromptRequestArgs<P, AIClient>) => {
    const completion = await requestCompletion(...args)

    if (completion.message.role === 'assistant') {
      return completion.message.content
    } else {
      throw new Error('Expected assistant completion')
    }
  }

  const requestJson = async (
    ...args: PromptRequestArgs<P, AIClient>
  ): Promise<Z extends z.ZodNever ? never : z.infer<Z>> => {
    const content = await requestContent(...args)
    return stringToJsonSchema
      .pipe(instruction.returns ?? z.undefined())
      .parse(content)
  }

  const base: BasePrompt<P, AIClient> = {
    requestCompletion: requestCompletion,
    requestContent: requestContent,
  }

  return (
    instruction.returns ? { ...base, requestJson } : base
  ) as Z extends ZodUndefined
    ? BasePrompt<P, AIClient>
    : JsonPrompt<P, z.infer<Z>, AIClient>
}

export const createPrompt = <
  P extends string,
  M extends ModelConfigBase,
  Z extends ZodType<any, ZodObjectDef>,
  AIClient,
>({
  getDefaultConfig,
  getChatCompletion,
  template,
  config,
  returns,
  joinTimeline = (systemEvent, timeline) => [systemEvent, ...timeline],
}: {
  getDefaultConfig: () => M
  getChatCompletion: (
    ai: AIClient,
    request: ChatRequest<M>,
  ) => Promise<ChatCompletion>
  template: Template<P>
  returns?: Z
  config?: M
  joinTimeline?: JoinTimelineFn
}) => {
  const instruction = createInstruction<P, M, Z>({
    getDefaultConfig,
    template,
    config,
    returns,
  })
  return createPromptWithInstruction(
    instruction,
    joinTimeline,
    getChatCompletion,
  )
}

export type JoinTimelineFn = (
  systemEvent: ChatMessage,
  timeline: ChatMessage[],
) => ChatMessage[]
