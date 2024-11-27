import type { z, ZodType } from "zod";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { OpenAI } from "openai";
import type { ImageGenerateParams } from "openai/resources/images.mjs";
import {
  JSON_PROMPT,
  stringToJsonSchema,
  zodToJsonSchema,
} from "./src/json.ts";

export type ChatRequest = {
  messages: ChatCompletionMessageParam[];
  joinMessages?: JoinMessagesFn;
};

export type OpenAIInferenceParams = {
  renderedTemplate: string;
  request: ChatRequest;
  config: ChatCompletionCreateParamsNonStreaming;
};

export const $getImageInference = async (
  openai: OpenAI,
  renderedTemplate: string,
  config: ImageGenerateParams,
): Promise<(string | undefined)[]> => {
  const response = await openai.images.generate({
    ...config,
    prompt: renderedTemplate,
  });

  if (config.response_format === "url") {
    return response.data.map((d) => d.url);
  } else if (config.response_format === "b64_json") {
    return response.data.map((d) => d.b64_json);
  }

  return [];
};

export type JoinMessagesFn = (
  renderedTemplate: string,
  messages: ChatCompletionMessageParam[],
) => ChatCompletionMessageParam[];
export const joinMessagesTop: JoinMessagesFn = (renderedTemplate, messages) => {
  return [{ role: "system" as const, content: renderedTemplate }, ...messages];
};
export const joinMessagesBottom: JoinMessagesFn = (
  renderedTemplate,
  messages,
) => {
  return [...messages, { role: "system" as const, content: renderedTemplate }];
};

export const $getTextInference = async (
  openai: OpenAI,
  { renderedTemplate, request, config }: OpenAIInferenceParams,
): Promise<OpenAI.Chat.Completions.ChatCompletion.Choice> => {
  const joinMessages = request?.joinMessages ?? joinMessagesTop;

  const messages = joinMessages(renderedTemplate, request.messages);
  const result = await openai.chat.completions.create({
    ...config,
    messages,
  });

  const firstChoice = result.choices[0];
  if (!firstChoice) throw new Error("no completion results");

  return firstChoice;
};

export const $getTextInferenceJson = async <T extends ZodType<any, any>>(
  openai: OpenAI,
  schema: T,
  { renderedTemplate, request, config }: OpenAIInferenceParams,
): Promise<z.infer<T>> => {
  const renderedWithJsonInstructions = renderedTemplate + "\n" + JSON_PROMPT;

  const completion = await $getTextInference(openai, {
    renderedTemplate: renderedWithJsonInstructions,
    request,
    config: {
      ...config,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "schema",
          schema: zodToJsonSchema(schema),
          strict: true,
        },
      },
    },
  });

  return stringToJsonSchema.pipe(schema).parse(completion.message.content);
};

export const respondWithImage = (
  openai: OpenAI,
  format: "url" | "b64_json",
): ({ renderedTemplate, request, config }: {
  renderedTemplate: string;
  request: string;
  config: ImageGenerateParams;
}) => Promise<(string | undefined)[]> =>
async ({
  renderedTemplate,
  request,
  config,
}: {
  renderedTemplate: string;
  request: string;
  config: ImageGenerateParams;
}) => {
  const description = renderedTemplate + "\n" + request;

  return await $getImageInference(openai, description, {
    ...config,
    response_format: format,
  });
};

export const respondWithCompletion = (
  openai: OpenAI,
): (
  params: OpenAIInferenceParams,
) => Promise<OpenAI.Chat.Completions.ChatCompletion.Choice> =>
async (params: OpenAIInferenceParams) =>
  await $getTextInference(openai, params);

export const respondWithString =
  (openai: OpenAI): (params: OpenAIInferenceParams) => Promise<string | null> =>
  async (params: OpenAIInferenceParams) =>
    (await $getTextInference(openai, params)).message.content;

export const respondWithJson = <T extends ZodType<any, any>>(
  openai: OpenAI,
  schema: T,
): (params: OpenAIInferenceParams) => Promise<z.TypeOf<T>> =>
(params: OpenAIInferenceParams) =>
  $getTextInferenceJson(openai, schema, params);
