import type { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { JSON_PROMPT, stringToJsonSchema } from "./src/json.ts";
import {
  type ChatRequest,
  type JoinMessagesFn,
  joinMessagesTop,
  type Message,
} from "./src/utils.ts";
import { makeJsonTemplateString } from "./src/json.ts";
import type { InferenceParams } from "./src/prompt.ts";

export type ImageInferenceParams<Together extends TogetherInterface> =
  InferenceParams<Parameters<Together["images"]["create"]>[0], string>;

export type ChatInferenceParams<
  Together extends TogetherInterface,
  M extends Message,
> = InferenceParams<
  ChatRequest<
    Parameters<Together["chat"]["completions"]["create"]>[0],
    M
  >,
  string
>;

export type ChatInferenceResult<Together extends TogetherInterface> = Awaited<
  ReturnType<Together["chat"]["completions"]["create"]>
>["choices"][number];

const jsonModeSupportedModels = [
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "mistralai/Mistral-7B-Instruct-v0.1 ",
];

/**
 * Builds inference functions for a Together client.
 *
 * @param together The Together client. You can import and pass any version that conforms to the
 *        type expectations.
 */
export const buildInferenceFunctionsForTogether:
  BuildInferenceFunctionsForTogether = <
    Together extends TogetherInterface,
    M extends Message,
  >(
    together: Together,
  ) => {
    type ChatFn = Together["chat"]["completions"]["create"];
    type ChatResult = Awaited<ReturnType<ChatFn>>["choices"][number];
    type ChatParamBody = Parameters<ChatFn>[0];
    type CR = ChatRequest<ChatParamBody, M>;

    type ImageFn = Together["images"]["create"];
    type ImageResult = (string | undefined)[];
    type ImageParamBody = Parameters<ImageFn>[0];
    type IR = ImageRequest<ImageParamBody>;

    type ImageInferenceParams = InferenceParams<IR, string>;
    type ChatInferenceParams = InferenceParams<CR, string>;

    const $inferImage = async ({
      renderedTemplate,
      request,
    }: ImageInferenceParams): Promise<ImageResult> => {
      const response = await together.images.create({
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
      const result = await together.chat.completions.create({
        ...request,
        messages,
      });

      const firstChoice = result.choices[0];
      if (!firstChoice) throw new Error("no completion results");

      return firstChoice;
    };

    const $inferJson = async <T extends ZodType>(
      schema: T,
      params: ChatInferenceParams,
    ): Promise<z.infer<T>> => {
      let choice: ChatResult;
      if (jsonModeSupportedModels.includes(params.request.model)) {
        // For models that support JSON mode, we'll use the JSON schema directly
        const renderedWithJsonInstructions = params.renderedTemplate + "\n" +
          JSON_PROMPT;
        choice = await $inferChoice(
          {
            ...params,
            renderedTemplate: renderedWithJsonInstructions,
            request: {
              ...params.request,
              response_format: {
                type: "json_object",
                schema: zodToJsonSchema(schema),
              },
            },
          },
        );
      } else {
        // For models that don't support JSON mode, we'll include the JSON schema in the prompt
        const renderedWithJsonInstructions = params.renderedTemplate + "\n" +
          makeJsonTemplateString(schema);
        choice = await $inferChoice({
          ...params,
          renderedTemplate: renderedWithJsonInstructions,
        });
      }

      return stringToJsonSchema.pipe(schema).parse(choice.message?.content);
    };

    const respondWithImage = (
      format: "url" | "b64_json" = "url",
    ) =>
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
      (await $inferChoice(params)).message?.content ?? null;

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

type ImageFile = {
  data: {
    b64_json?: string;
    url?: string;
  }[];
};

type Completion = {
  choices: {
    message?: {
      role: "assistant";
      content: string | null;
      // tool_calls: []
    };
  }[];
};

type ImageRequest<P> = P;

type TogetherInterface = {
  images: {
    create(
      body: any,
      options?: any,
    ): Promise<ImageFile>;
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
type BuildInferenceFunctionsForTogether = <
  Together extends TogetherInterface,
  M extends Message,
>(
  openai: Together,
) => {
  $inferImage: (params: ImageInferenceParams<Together>) =>
    Promise<(string | undefined)[]>;

  $inferChoice: (params: ChatInferenceParams<Together, M>) =>
    Promise<ChatInferenceResult<Together>>;

  $inferJson: <T extends ZodType>(schema: T, params: ChatInferenceParams<Together, M>) =>
    Promise<z.infer<T>>;

  respondWithImage: (format?: "url" | "b64_json") =>
    (params: ImageInferenceParams<Together>) =>
      Promise<(string | undefined)[]>;

  respondWithChoice: () =>
    (params: ChatInferenceParams<Together, M>) =>
      Promise<ChatInferenceResult<Together>>;

  respondWithText: () =>
    (params: ChatInferenceParams<Together, M>) =>
      Promise<string | null>;

  respondWithJson: <T extends ZodType>(schema: T) =>
    (params: ChatInferenceParams<Together, M>) =>
      Promise<z.infer<T>>;
};
