import { ZodObjectDef, ZodType, ZodUndefined, z } from 'zod'
import {
  ChatCompletion,
  ChatMessage,
  ChatSystemMessage,
  ModelConfigBase,
} from './types'
import { IfNever, Template } from './template'
import { Instruction, createInstruction } from './instruction'
import { stringToJsonSchema } from './json'

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<M extends ModelConfigBase, P extends string> = IfNever<
  P,
  { timeline: ChatMessage[]; config?: M },
  { timeline: ChatMessage[]; params: { [key in P]: string }; config?: M }
>
export type BasePrompt<M extends ModelConfigBase, P extends string> = {
  requestCompletion: (args: PromptRequestArgs<M, P>) => Promise<ChatCompletion>
  requestContent: (args: PromptRequestArgs<M, P>) => Promise<string>
}

export type JsonPrompt<
  M extends ModelConfigBase,
  P extends string,
  T,
> = BasePrompt<M, P> & {
  requestJson: (args: PromptRequestArgs<M, P>) => Promise<T>
}

type GetChatCompletionFn<M extends ModelConfigBase> = (
  messages: ChatMessage[],
  config: M,
) => Promise<ChatCompletion>

export const createPromptWithInstruction = <
  T,
  M extends ModelConfigBase,
  P extends string,
  Z extends ZodType<T, ZodObjectDef>,
>(
  instruction: Instruction<M, P, Z>,
  joinTimeline: JoinTimelineFn = (systemMessage, timeline) => [
    systemMessage,
    ...timeline,
  ],
  getChatCompletion: GetChatCompletionFn<M>,
): Z extends ZodUndefined ? BasePrompt<M, P> : JsonPrompt<M, P, z.infer<Z>> => {
  // Simplest request--get the completion as returned by getChatCompletion
  const requestCompletion = async (args: PromptRequestArgs<M, P>) => {
    const systemEvent: ChatSystemMessage = {
      role: 'system',
      content: instruction.template.render(
        'params' in args
          ? (args.params as IfNever<P, undefined, { [key in P]: string }>)
          : undefined,
      ),
    }

    const config: M = {
      responseFormat: 'natural',
      ...instruction.config,
      ...args.config,
    }
    const messages = joinTimeline(systemEvent, args.timeline)

    return await getChatCompletion(messages, config)
  }

  // Next level of abstraction: get the (text) content from the completion
  const requestContent = async (args: PromptRequestArgs<M, P>) => {
    const completion = await requestCompletion(args)

    if (completion.message.role === 'assistant') {
      return completion.message.content
    } else {
      throw new Error('Expected assistant completion')
    }
  }

  // Highest level of abstraction: get the JSON content from the completion
  const requestJson = async (
    args: PromptRequestArgs<M, P>,
  ): Promise<Z extends z.ZodNever ? never : z.infer<Z>> => {
    const content = await requestContent({
      ...args,
      config: { ...args.config, responseFormat: 'json' },
    })
    return stringToJsonSchema
      .pipe(instruction.returns ?? z.undefined())
      .parse(content)
  }

  const base: BasePrompt<M, P> = {
    requestCompletion: requestCompletion,
    requestContent: requestContent,
  }

  return (
    instruction.returns ? { ...base, requestJson } : base
  ) as Z extends ZodUndefined ? BasePrompt<M, P> : JsonPrompt<M, P, z.infer<Z>>
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
  getChatCompletion: GetChatCompletionFn<M>
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
