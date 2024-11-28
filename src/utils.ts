export type ImageRequest<P> = P;

export type Message = {
  content: string;
  role: "system" | "user" | "assistant" | "tool";
};

export type ChatRequest<P, M extends Message = Message> = P & {
  messages: M[];
  joinMessages?: JoinMessagesFn<M>;
};

export type JoinMessagesFn<M extends Message> = (
  renderedTemplate: string,
  messages: M[],
  makeSystemMessage: (content: string) => M,
) => M[];

export const joinMessagesTop = <M extends Message>(
  renderedTemplate: string,
  messages: M[],
  makeSystemMessage: (content: string) => M,
): M[] => {
  return [makeSystemMessage(renderedTemplate), ...messages];
};

export const joinMessagesBottom = <M extends Message>(
  renderedTemplate: string,
  messages: M[],
  makeSystemMessage: (content: string) => M,
): M[] => {
  return [
    ...messages,
    makeSystemMessage(renderedTemplate),
  ];
};
