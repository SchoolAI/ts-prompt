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
type PromptRequestArgs<P extends string> = IfNever<
  P,
  [timeline: ChatMessage[]],
  [timeline: ChatMessage[], params: { [key in P]: string }]
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
  M extends ModelConfigBase,
  P extends string,
  Z extends ZodType<T, ZodObjectDef>,
>(
  instruction: Instruction<M, P, Z>,
  joinTimeline: JoinTimelineFn = (systemEvent, timeline) => [
    systemEvent,
    ...timeline,
  ],
  getChatCompletion: (request: ChatRequest<M>) => Promise<ChatCompletion>,
): Z extends ZodUndefined ? BasePrompt<P> : JsonPrompt<P, z.infer<Z>> => {
  const requestCompletion = async (
    ...[timeline, params]: PromptRequestArgs<P>
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

    return await getChatCompletion(request)
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
  ): Promise<Z extends z.ZodNever ? never : z.infer<Z>> => {
    const content = await requestContent(...args)
    return stringToJsonSchema
      .pipe(instruction.returns ?? z.undefined())
      .parse(content)
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
  M extends ModelConfigBase,
  P extends string,
  Z extends ZodType<any, ZodObjectDef>,
>({
  getChatCompletion,
  config,
  template,
  returns,
  joinTimeline = (systemEvent, timeline) => [systemEvent, ...timeline],
}: {
  getChatCompletion: (request: ChatRequest<M>) => Promise<ChatCompletion>
  config: M
  template: Template<P>
  returns?: Z
  joinTimeline?: JoinTimelineFn
}) => {
  const instruction = createInstruction<M, P, Z>({
    config,
    template,
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
