import type { InferenceParams } from "^/prompt.ts";

type ImageGenerateParamBody = {
  model: string;
  response_format: "url" | "base64";
  prompt: string;
};

type ImageFile = {
  data: {
    b64_json?: string;
    url?: string;
  }[];
};

export type TogetherInterface = {
  images: {
    create(
      body: ImageGenerateParamBody,
      options?: any,
    ): Promise<ImageFile>;
  };
};

type ImagesResponse = {
  created: number;
  data: { b64_json?: string; url?: string }[];
};

export type ImagePromptContext<Together extends TogetherInterface> = {
  body: Omit<Parameters<Together["images"]["create"]>[0], "prompt">;
  options: Parameters<Together["images"]["create"]>[1];
};

export type Types<OpenAI extends TogetherInterface> = {
  context: ImagePromptContext<OpenAI>;
  result: (string | undefined)[];
  inferenceParams: InferenceParams<ImagePromptContext<OpenAI>>;
};

/**
 * Builds inference functions for an OpenAI client.
 *
 * @param together The OpenAI client. You can import and pass any version that conforms to the
 *        type expectations.
 */
export const buildImageInferenceFunctionsForTogether = <
  Together extends TogetherInterface,
  T extends Types<Together>,
>(
  together: Together,
) => {
  const mergeContext = (params: T["inferenceParams"]): T["context"] => {
    return {
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
    const response = await together.images.create({
      ...body,
      prompt: renderedTemplate,
    }, options);

    switch (body.response_format) {
      case "url":
        return response.data.map((d) => d.url);
      case "base64":
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
    mergeContext,
    inferImageRaw,
    inferImage,
    respondWithImage,
  };
};
