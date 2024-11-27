import type { z, ZodType } from "zod";
import {
  JSON_PROMPT,
  stringToJsonSchema,
  zodToJsonSchema,
} from "./src/json.ts";

// import { OpenAI } from "openai";

export type ChatRequest<P, M = unknown> = P & {
  messages: M[];
  joinMessages?: JoinMessagesFn<M>;
};

export type ImageRequest<P> = P;

export type JoinMessagesFn<M> = (
  renderedTemplate: string,
  messages: M[],
) => M[];

export const joinMessagesTop = <M>(
  renderedTemplate: string,
  messages: (SystemMessage | M)[],
): (SystemMessage | M)[] => {
  return [{ role: "system", content: renderedTemplate }, ...messages];
};

export const joinMessagesBottom = <M>(
  renderedTemplate: string,
  messages: (SystemMessage | M)[],
): (SystemMessage | M)[] => {
  return [...messages, { role: "system", content: renderedTemplate }];
};

export type OpenAIInferenceParams<Request> = {
  renderedTemplate: string;
  request: Request;
};

export type OpenAIInterface = {
  images: {
    generate(
      body: any,
      options?: any,
    ): Promise<ImagesResponse>;
  };
  chat: {
    completions: {
      create(
        body: any,
        options?: any,
      ): Promise<Completion>;
    };
  };
};

export const buildInferenceFunctionsForOpenAI = <
  OpenAI extends OpenAIInterface,
>(
  openai: OpenAI,
) => {
  type ChatFn = OpenAI["chat"]["completions"]["create"];
  type ChatResult = Awaited<ReturnType<ChatFn>>["choices"][number];
  type ChatParamBody = Parameters<ChatFn>[0];
  type ChatResultMessage = ChatResult["message"];
  type CR = ChatRequest<ChatParamBody, ChatResultMessage>;

  type ImageFn = OpenAI["images"]["generate"];
  type ImageResult = (string | undefined)[];
  type ImageParamBody = Parameters<ImageFn>[0];
  type IR = ImageRequest<ImageParamBody>;

  type ImageParams = { renderedTemplate: string; request: IR };
  type ChatParams = { renderedTemplate: string; request: CR };

  const $inferImage = async (
    renderedTemplate: string,
    request: IR,
  ): Promise<ImageResult> => {
    const response = await openai.images.generate({
      ...request,
      prompt: renderedTemplate,
    });

    if (request.response_format === "url") {
      return response.data.map((d) => d.url);
    } else if (request.response_format === "b64_json") {
      return response.data.map((d) => d.b64_json);
    }

    return [];
  };

  const $inferChoice = async (
    renderedTemplate: string,
    request: CR,
  ): Promise<ChatResult> => {
    const joinMessages = request?.joinMessages ?? joinMessagesTop;

    const messages = joinMessages(renderedTemplate, request.messages);
    const result = await openai.chat.completions.create({
      ...request,
      messages,
    } as ChatParamBody);

    const firstChoice = result.choices[0];
    if (!firstChoice) throw new Error("no completion results");

    return firstChoice;
  };

  const $inferJson = async <T extends ZodType>(
    schema: T,
    renderedTemplate: string,
    request: CR,
  ): Promise<z.infer<T>> => {
    const renderedWithJsonInstructions = renderedTemplate + "\n" + JSON_PROMPT;

    const choice = await $inferChoice(
      renderedWithJsonInstructions,
      {
        ...request,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "schema",
            schema: zodToJsonSchema(schema),
            strict: true,
          },
        },
      },
    );

    return stringToJsonSchema.pipe(schema).parse(choice.message.content);
  };

  const respondWithImage = (
    format: "url" | "b64_json" = "url",
  ): (
    params: ImageParams,
  ) => Promise<(string | undefined)[]> =>
  async (
    params: ImageParams,
  ) => {
    return await $inferImage(params.renderedTemplate, {
      ...params.request,
      response_format: format,
    });
  };

  const respondWithChoice =
    (): (params: ChatParams) => Promise<ChatResult> =>
    async (params: ChatParams) =>
      await $inferChoice(params.renderedTemplate, params.request);

  const respondWithText =
    (): (params: ChatParams) => Promise<string | null> =>
    async (params: ChatParams) =>
      (await $inferChoice(params.renderedTemplate, params.request)).message
        .content;

  const respondWithJson = <T extends ZodType>(
    schema: T,
  ): (params: ChatParams) => Promise<z.TypeOf<T>> =>
  (params: ChatParams) =>
    $inferJson(schema, params.renderedTemplate, params.request);

  return {
    $inferImage,
    $inferChoice,
    $inferJson,
    respondWithImage,
    respondWithChoice,
    respondWithText,
    respondWithJson,
  };
};

type SystemMessage = {
  role: "system";
  content: string;
};

type ImagesResponse = {
  created: number;
  data: { b64_json?: string; url?: string }[];
};

type Completion = {
  choices: {
    message: {
      content: string | null;
      role: "assistant";
    };
  }[];
};
