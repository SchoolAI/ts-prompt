import { type InferenceParams, initPromptBuilder } from "^/prompt.ts";

type ImageGenerateParamBody = {
  response_format: "url" | "b64_json";
  prompt: string;
};

export type OpenAIInterface = {
  images: {
    generate(
      body: ImageGenerateParamBody,
      options?: object,
    ): Promise<ImagesResponse>;
  };
};

type ImagesResponse = {
  created: number;
  data: { b64_json?: string; url?: string }[];
};

export type ImagePromptContext<OpenAI extends OpenAIInterface, AddCtx> = {
  body: Omit<Parameters<OpenAI["images"]["generate"]>[0], "prompt">;
  options: Parameters<OpenAI["images"]["generate"]>[1];
} & AddCtx;

export type Types<OpenAI extends OpenAIInterface, AddCtx> = {
  context: ImagePromptContext<OpenAI, Partial<AddCtx>>;
  result: (string | undefined)[];
  inferenceParams: InferenceParams<ImagePromptContext<OpenAI, Partial<AddCtx>>>;
};

/**
 * Builds inference functions for an OpenAI client.
 *
 * @param openai The OpenAI client. You can import and pass any version that conforms to the
 *        type expectations.
 */
export function buildImageFunctions<
  AddCtx,
  OpenAI extends OpenAIInterface = OpenAIInterface,
>(openai: OpenAI) {
  type T = Types<OpenAI, AddCtx>;
  const initImagePromptBuilder = initPromptBuilder<T["context"]>;

  const mergeContext = (params: T["inferenceParams"]): T["context"] => {
    return {
      ...params.contextFromBuilder,
      ...params.contextFromPrompt,
      ...params.contextFromRequest,
      body: {
        ...params.contextFromBuilder.body,
        ...params.contextFromPrompt?.body,
        ...params.contextFromRequest?.body,
      },
      options: {
        ...params.contextFromBuilder.options,
        ...params.contextFromPrompt?.options,
        ...params.contextFromRequest?.options,
      },
    };
  };

  const inferImageRaw = async (
    renderedTemplate: T["inferenceParams"]["renderedTemplate"],
    { body, options }: T["context"],
  ): Promise<T["result"]> => {
    const response = await openai.images.generate({
      ...body,
      prompt: renderedTemplate,
    }, options);

    switch (body.response_format) {
      case "url":
        return response.data.map((d) => d.url);
      case "b64_json":
        return response.data.map((d) => d.b64_json);
      default:
        return [];
    }
  };

  const inferImage = async (params: T["inferenceParams"]) => {
    const context = mergeContext(params);
    return await inferImageRaw(params.renderedTemplate, context);
  };

  const respondWithImage =
    (format: "url" | "b64_json" = "url") =>
    async (params: T["inferenceParams"]) => {
      const context = mergeContext(params);
      return await inferImageRaw(params.renderedTemplate, {
        ...context,
        body: {
          ...context.body,
          response_format: format,
        },
      });
    };

  return {
    initImagePromptBuilder,
    mergeContext,
    inferImageRaw,
    inferImage,
    respondWithImage,
  };
}
