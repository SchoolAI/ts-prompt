import type { InferenceParams } from "./prompt.ts";

/**
 * Type definition of a function capable of merging messages with a rendered template.
 */
export type MergeMessagesFn<Message> = (
  renderedTemplate: string,
  messages: Message[],
  makeSystemMessage: (content: string) => Message,
) => Message[];

/**
 * A message merge function that puts the system message at the top of the messages.
 */
export const mergeMessagesTop = <Message>(
  renderedTemplate: string,
  messages: Message[],
  makeSystemMessage: (content: string) => Message,
): Message[] => {
  return [makeSystemMessage(renderedTemplate), ...messages];
};

/**
 * A message merge function that puts the system message at the bottom of the messages.
 */
export const mergeMessagesBottom = <Message>(
  renderedTemplate: string,
  messages: Message[],
  makeSystemMessage: (content: string) => Message,
): Message[] => {
  return [
    ...messages,
    makeSystemMessage(renderedTemplate),
  ];
};

/**
 * A context merge function that merges the context from the builder, prompt, and request.
 * This function uses the "simplest" merge strategy, which is a shallow merge, preferring
 * request values over prompt values, and prompt values over builder values.
 */
export const mergeContext = <Ctx>(params: InferenceParams<Ctx>) => {
  return {
    ...params.contextFromBuilder,
    ...params.contextFromPrompt,
    ...params.contextFromRequest,
  };
};
