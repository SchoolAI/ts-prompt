import {
  buildChatInferenceFunctionsForOpenAI,
  type ChatPromptContext,
  type OpenAIInterface as OpenAIInterfaceForChat,
} from "^/openai/openai-chat.ts";
import {
  buildImageInferenceFunctionsForOpenAI,
  type ImagePromptContext,
  type OpenAIInterface as OpenAIInterfaceForImage,
} from "^/openai/openai-image.ts";
import { initPromptBuilder } from "^/prompt.ts";

export { type ChatPromptContext } from "^/openai/openai-chat.ts";
export { type ImagePromptContext } from "^/openai/openai-image.ts";

export type OpenAIInterface<Message> =
  & OpenAIInterfaceForChat<Message>
  & OpenAIInterfaceForImage;

export const buildInferenceFunctionsForOpenAI = <
  Message,
  OpenAI extends OpenAIInterface<Message>,
>(
  openai: OpenAI,
) => {
  const initChatPromptBuilder = initPromptBuilder<
    ChatPromptContext<Message, OpenAI>
  >;
  const initImagePromptBuilder = initPromptBuilder<ImagePromptContext<OpenAI>>;
  return {
    initChatPromptBuilder,
    initImagePromptBuilder,
    ...buildChatInferenceFunctionsForOpenAI(openai),
    ...buildImageInferenceFunctionsForOpenAI(openai),
  };
};
