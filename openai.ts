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
import type { InferenceParams } from "./src/prompt.ts";

export type ImageInferenceParams<OpenAI extends OpenAIInterface> =
  InferenceParams<Parameters<OpenAI["images"]["generate"]>[0], string>;

export type ChatInferenceParams<
  OpenAI extends OpenAIInterface,
  M extends Message,
> = InferenceParams<
  ChatRequest<
    Parameters<OpenAI["chat"]["completions"]["create"]>[0],
    M
  >,
  string
>;

export type ChatInferenceResult<OpenAI extends OpenAIInterface> = Awaited<
  ReturnType<OpenAI["chat"]["completions"]["create"]>
>["choices"][number];

// Use openai's vendored zodToJsonSchema
const zodToJsonSchema = (
  schema: ZodType,
): Record<string, unknown> | undefined =>
  zodResponseFormat(schema, "result").json_schema.schema;

/**
 * Builds inference functions for an OpenAI client.
 *
 * @param openai The OpenAI client. You can import and pass any version that conforms to the
 *        type expectations.
 */
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

    type ImageInferenceParams = InferenceParams<IR, string>;
    type ChatInferenceParams = InferenceParams<CR, string>;

    const $inferImage = async ({
      renderedTemplate,
      request,
    }: ImageInferenceParams): Promise<ImageResult> => {
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

    const $inferChoice = async ({
      renderedTemplate,
      request,
    }: ChatInferenceParams): Promise<ChatResult> => {
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
      params: ChatInferenceParams,
    ): Promise<z.infer<T>> => {
      const renderedWithJsonInstructions = params.renderedTemplate + "\n" +
        JSON_PROMPT;

      const choice = await $inferChoice(
        {
          ...params,
          renderedTemplate: renderedWithJsonInstructions,
          request: {
            ...params.request,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "schema",
                schema: zodToJsonSchema(schema),
                strict: true,
              },
            },
          },
        },
      );

      return stringToJsonSchema.pipe(schema).parse(choice.message.content);
    };

    const respondWithImage = (
      format: "url" | "b64_json" = "url",
    ): (
      params: ImageInferenceParams,
    ) => Promise<(string | undefined)[]> =>
    async (
      params: ImageInferenceParams,
    ) => {
      return await $inferImage({
        ...params,
        request: {
          ...params.request,
          response_format: format,
        },
      });
    };

    const respondWithChoice = () => async (params: ChatInferenceParams) =>
      await $inferChoice(params);

    const respondWithText = () => async (params: ChatInferenceParams) =>
      (await $inferChoice(params)).message.content;

    const respondWithJson =
      <T extends ZodType>(schema: T) => (params: ChatInferenceParams) =>
        $inferJson(schema, params);

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

type OpenAIInterface = {
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

// deno-fmt-ignore
type BuildInferenceFunctionsForOpenAI = <
  OpenAI extends OpenAIInterface,
  M extends Message,
>(
  openai: OpenAI,
) => {
  $inferImage: (params: ImageInferenceParams<OpenAI>) =>
    Promise<(string | undefined)[]>;

  $inferChoice: (params: ChatInferenceParams<OpenAI, M>) =>
    Promise<ChatInferenceResult<OpenAI>>;

  $inferJson: <T extends ZodType>(schema: T, params: ChatInferenceParams<OpenAI, M>) =>
    Promise<z.infer<T>>;

  respondWithImage: (format?: "url" | "b64_json") =>
    (params: ImageInferenceParams<OpenAI>) =>
      Promise<(string | undefined)[]>;

  respondWithChoice: () =>
    (params: ChatInferenceParams<OpenAI, M>) =>
      Promise<ChatInferenceResult<OpenAI>>;

  respondWithText: () =>
    (params: ChatInferenceParams<OpenAI, M>) =>
      Promise<string | null>;

  respondWithJson: <T extends ZodType>(schema: T) =>
    (params: ChatInferenceParams<OpenAI, M>) =>
      Promise<z.infer<T>>;
};
