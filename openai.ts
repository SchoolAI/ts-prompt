import type { z, ZodType } from "zod";
import { zodResponseFormat } from "npm:openai@4.73.1/helpers/zod";
import { JSON_PROMPT, stringToJsonSchema } from "./src/json.ts";
import {
  type ChatRequest,
  type ImageRequest,
  type JoinMessagesFn,
  joinMessagesTop,
  type Message,
} from "./src/utils.ts";

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

// Use openai's vendored zodToJsonSchema
const zodToJsonSchema = (
  schema: ZodType,
): Record<string, unknown> | undefined =>
  zodResponseFormat(schema, "result").json_schema.schema;

export const buildInferenceFunctionsForOpenAI:
  BuildInferenceFunctionsForOpenAI = <
    OpenAI extends OpenAIInterface,
    M extends Message,
  >(
    openai: OpenAI,
  ) => {
    type ChatFn = OpenAI["chat"]["completions"]["create"];
    type ChatResult = Awaited<ReturnType<ChatFn>>["choices"][number];
    type ChatParamBody = Parameters<ChatFn>[0];
    type ChatResultMessage = ChatResult["message"];
    type CR = ChatRequest<ChatParamBody, M>;

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
      const joinMessages: JoinMessagesFn<M> = request?.joinMessages ??
        joinMessagesTop;

      const messages = joinMessages(
        renderedTemplate,
        request.messages,
        (content) => ({ content, role: "system" } as M),
      );
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
      const renderedWithJsonInstructions = renderedTemplate + "\n" +
        JSON_PROMPT;

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

// This remarkable type signature was generated via "deno task build" and then by copying
// the type from npm/esm/openai.d.ts
type BuildInferenceFunctionsForOpenAI = <
  OpenAI extends OpenAIInterface,
  M extends Message,
>(
  openai: OpenAI,
) => {
  $inferImage: (
    renderedTemplate: string,
    request: Parameters<OpenAI["images"]["generate"]>[0],
  ) => Promise<(string | undefined)[]>;
  $inferChoice: (
    renderedTemplate: string,
    request: ChatRequest<
      Parameters<OpenAI["chat"]["completions"]["create"]>[0],
      M
    >,
  ) => Promise<
    Awaited<
      ReturnType<OpenAI["chat"]["completions"]["create"]>
    >["choices"][number]
  >;
  $inferJson: <T extends ZodType>(
    schema: T,
    renderedTemplate: string,
    request: ChatRequest<
      Parameters<OpenAI["chat"]["completions"]["create"]>[0],
      M
    >,
  ) => Promise<z.infer<T>>;
  respondWithImage: (format?: "url" | "b64_json") => (params: {
    renderedTemplate: string;
    request: Parameters<OpenAI["images"]["generate"]>[0];
  }) => Promise<(string | undefined)[]>;
  respondWithChoice: () => (params: {
    renderedTemplate: string;
    request: ChatRequest<
      Parameters<OpenAI["chat"]["completions"]["create"]>[0],
      M
    >;
  }) => Promise<
    Awaited<
      ReturnType<OpenAI["chat"]["completions"]["create"]>
    >["choices"][number]
  >;
  respondWithText: () => (params: {
    renderedTemplate: string;
    request: ChatRequest<
      Parameters<OpenAI["chat"]["completions"]["create"]>[0],
      M
    >;
  }) => Promise<string | null>;
  respondWithJson: <T extends ZodType>(schema: T) => (params: {
    renderedTemplate: string;
    request: ChatRequest<
      Parameters<OpenAI["chat"]["completions"]["create"]>[0],
      M
    >;
  }) => Promise<z.TypeOf<T>>;
};
