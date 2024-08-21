import { ZodObjectDef, ZodType, ZodUndefined, z } from 'zod'
import { ChatCompletion, ChatMessage, ChatSystemMessage } from './types'
import { ExtractParams, IfNever, Template } from './template'
import { Instruction, createInstruction } from './instruction'
import { stringToJsonSchema } from './json'

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<I, P extends string> = IfNever<
  P,
  { timeline: ChatMessage[]; input?: I },
  { timeline: ChatMessage[]; params: { [key in P]: string }; input?: I }
>
export type BasePrompt<I, P extends string> = {
  requestCompletion: (args: PromptRequestArgs<I, P>) => Promise<ChatCompletion>
  requestContent: (args: PromptRequestArgs<I, P>) => Promise<string>
}

export type JsonPrompt<I, P extends string, T> = BasePrompt<I, P> & {
  requestJson: (args: PromptRequestArgs<I, P>) => Promise<T>
}

export type InferenceFn<I> = (
  messages: ChatMessage[],
  input: I,
) => Promise<ChatCompletion>

export const createPromptWithInstruction = <
  T,
  I,
  P extends string,
  Z extends ZodType<T, ZodObjectDef>,
>(
  instruction: Instruction<I, P, Z>,
  joinTimeline: JoinTimelineFn = (systemMessage, timeline) => [
    systemMessage,
    ...timeline,
  ],
  getChatCompletion: InferenceFn<I>,
): Z extends ZodUndefined ? BasePrompt<I, P> : JsonPrompt<I, P, z.infer<Z>> => {
  // Simplest request--get the completion as returned by getChatCompletion
  const requestCompletion = async (args: PromptRequestArgs<I, P>) => {
    const systemEvent: ChatSystemMessage = {
      role: 'system',
      content: instruction.template.render(
        'params' in args
          ? (args.params as IfNever<P, undefined, { [key in P]: string }>)
          : undefined,
      ),
    }

    const config: I = {
      responseFormat: 'natural',
      ...instruction.input,
      ...args.input,
    }
    const messages = joinTimeline(systemEvent, args.timeline)

    return await getChatCompletion(messages, config)
  }

  // Next level of abstraction: get the (text) content from the completion
  const requestContent = async (args: PromptRequestArgs<I, P>) => {
    const completion = await requestCompletion(args)

    if (completion.message.role === 'assistant') {
      return completion.message.content
    } else {
      throw new Error('Expected assistant completion')
    }
  }

  // Highest level of abstraction: get the JSON content from the completion
  const requestJson = async (
    args: PromptRequestArgs<I, P>,
  ): Promise<Z extends z.ZodNever ? never : z.infer<Z>> => {
    const content = await requestContent({
      ...args,
      config: { ...args.input, responseFormat: 'json' },
    })
    return stringToJsonSchema
      .pipe(instruction.returns ?? z.undefined())
      .parse(content)
  }

  const base: BasePrompt<I, P> = {
    requestCompletion: requestCompletion,
    requestContent: requestContent,
  }

  return (
    instruction.returns ? { ...base, requestJson } : base
  ) as Z extends ZodUndefined ? BasePrompt<I, P> : JsonPrompt<I, P, z.infer<Z>>
}

/**
 * `initPrompt` is a factory function. It should be used once to create a function (e.g.
 * 'mkPrompt') that creates prompts. Pass it a function that returns completions, and a default
 * config, and it will return a function that expects a prompt template, and optionally config
 * overrides and a zod schema for the return
 * value.
 */
export const initPrompt =
  <I>(getChatCompletion: InferenceFn<I>, defaultConfig: I) =>
  <S extends string, Z extends ZodType<any, ZodObjectDef>>({
    config,
    template,
    returns,
    joinTimeline = (systemEvent, timeline) => [systemEvent, ...timeline],
  }: {
    config?: I
    template: S
    returns?: Z
    joinTimeline?: JoinTimelineFn
  }): Z extends ZodUndefined
    ? BasePrompt<I, ExtractParams<S>>
    : JsonPrompt<I, ExtractParams<S>, z.infer<Z>> => {
    return createPromptWithInstruction(
      createInstruction<I, ExtractParams<S>, Z>({
        input: { ...defaultConfig, ...config },
        template: Template.build(template),
        returns,
      }),
      joinTimeline,
      getChatCompletion,
    )
  }

export type JoinTimelineFn = (
  systemEvent: ChatMessage,
  timeline: ChatMessage[],
) => ChatMessage[]
