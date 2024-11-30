import {
  buildChatInferenceFunctionsForTogether,
  type ChatPromptContext,
  type TogetherInterface as TogetherInterfaceForChat,
} from "^/together/together-chat.ts";
import {
  buildImageInferenceFunctionsForTogether,
  type ImagePromptContext,
  type TogetherInterface as TogetherInterfaceForImage,
} from "^/together/together-image.ts";
import { initPromptBuilder } from "^/prompt.ts";

export { type ChatPromptContext } from "^/together/together-chat.ts";
export { type ImagePromptContext } from "^/together/together-image.ts";

export type TogetherInterface<Message> =
  & TogetherInterfaceForChat<Message>
  & TogetherInterfaceForImage;

export const buildInferenceFunctionsForTogether = <
  Message,
  Together extends TogetherInterface<Message>,
>(
  together: Together,
) => {
  const initChatPromptBuilder = initPromptBuilder<
    ChatPromptContext<Message, Together>
  >;
  const initImagePromptBuilder = initPromptBuilder<
    ImagePromptContext<Together>
  >;
  return {
    initChatPromptBuilder,
    initImagePromptBuilder,
    ...buildChatInferenceFunctionsForTogether(together),
    ...buildImageInferenceFunctionsForTogether(together),
  };
};
