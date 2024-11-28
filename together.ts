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

    type ImageParams = { renderedTemplate: string; request: IR };
    type ChatParams = { renderedTemplate: string; request: CR };

    const $inferImage = async (
      renderedTemplate: string,
      request: IR,
    ): Promise<ImageResult> => {
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
      renderedTemplate: string,
      request: CR,
    ): Promise<z.infer<T>> => {
      let choice: ChatResult;
      if (jsonModeSupportedModels.includes(request.model)) {
        // For models that support JSON mode, we'll use the JSON schema directly
        const renderedWithJsonInstructions = renderedTemplate + "\n" +
          JSON_PROMPT;
        choice = await $inferChoice(
          renderedWithJsonInstructions,
          {
            ...request,
            response_format: {
              type: "json_object",
              schema: zodToJsonSchema(schema),
            },
          },
        );
      } else {
        // For models that don't support JSON mode, we'll include the JSON schema in the prompt
        const renderedWithJsonInstructions = renderedTemplate + "\n" +
          makeJsonTemplateString(schema);
        choice = await $inferChoice(
          renderedWithJsonInstructions,
          request,
        );
      }

      return stringToJsonSchema.pipe(schema).parse(choice.message?.content);
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
          ?.content ?? null;

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

export type ImageInferenceParams<Together extends TogetherInterface> = {
  renderedTemplate: string;
  request: Parameters<Together["images"]["create"]>[0];
};

export type ChatInferenceParams<
  Together extends TogetherInterface,
  M extends Message,
> = {
  renderedTemplate: string;
  request: ChatRequest<
    Parameters<Together["chat"]["completions"]["create"]>[0],
    M
  >;
};

export type ChatInferenceResult<Together extends TogetherInterface> = Awaited<
  ReturnType<Together["chat"]["completions"]["create"]>
>["choices"][number];

type BuildInferenceFunctionsForTogether = <
  Together extends TogetherInterface,
  M extends Message,
>(
  openai: Together,
) => {
  $inferImage: (
    renderedTemplate: string,
    request: ImageInferenceParams<Together>["request"],
  ) => Promise<(string | undefined)[]>;
  $inferChoice: (
    renderedTemplate: string,
    request: ChatInferenceParams<Together, M>["request"],
  ) => Promise<ChatInferenceResult<Together>>;
  $inferJson: <T extends ZodType>(
    schema: T,
    renderedTemplate: string,
    request: ChatInferenceParams<Together, M>["request"],
  ) => Promise<z.infer<T>>;
  respondWithImage: (
    format?: "url" | "b64_json",
  ) => (
    params: ImageInferenceParams<Together>,
  ) => Promise<(string | undefined)[]>;
  respondWithChoice: () => (
    params: ChatInferenceParams<Together, M>,
  ) => Promise<
    ChatInferenceResult<Together>
  >;
  respondWithText: () => (
    params: ChatInferenceParams<Together, M>,
  ) => Promise<string | null>;
  respondWithJson: <T extends ZodType>(
    schema: T,
  ) => (params: ChatInferenceParams<Together, M>) => Promise<z.TypeOf<T>>;
};
