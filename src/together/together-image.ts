import {
  type InferenceFn,
  type InferenceParams,
  initPromptBuilder,
  type TemplateArgs,
} from "^/prompt.ts";
import type { ExtractPlaceholders, IfNever } from "^/template.ts";

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

type TogetherInterface = {
  images: {
    create(
      body: ImageGenerateParamBody,
      options?: any,
    ): Promise<ImageFile>;
  };
};

/**
 * The type of the context object that is passed to the prompt builder and inference functions.
 */
export type ImagePromptContext<Together extends TogetherInterface, AddCtx> = {
  body: Omit<Parameters<Together["images"]["create"]>[0], "prompt">;
  options: Parameters<Together["images"]["create"]>[1];
} & AddCtx;

type Types<OpenAI extends TogetherInterface, AddCtx> = {
  context: ImagePromptContext<OpenAI, AddCtx>;
  result: (string | undefined)[];
  inferenceParams: InferenceParams<ImagePromptContext<OpenAI, AddCtx>>;
};

/**
 * Builds inference functions for an OpenAI client.
 *
 * @param together The OpenAI client. You can import and pass any version that conforms to the
 *        type expectations.
 */
export const buildImageFunctions: BuildImageFunctions = <
  AddCtx,
  Together extends TogetherInterface = TogetherInterface,
>(together: Together) => {
  type T = Types<Together, AddCtx>;

  const initImagePromptBuilder = initPromptBuilder<
    ImagePromptContext<Together, AddCtx>
  >;

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
    initImagePromptBuilder,
    mergeContext,
    inferImageRaw,
    inferImage,
    respondWithImage,
  };
};

type BuildImageFunctions = <
  AddCtx,
  Together extends TogetherInterface = TogetherInterface,
>(together: Together) => {
  initImagePromptBuilder: (
    contextFromBuilder: ImagePromptContext<Together, AddCtx>,
  ) => <
    TemplateString extends string,
    Infer extends InferenceFn<
      ImagePromptContext<Together, AddCtx>,
      ExtractPlaceholders<TemplateString>,
      any
    >,
  >(
    template: TemplateString,
    infer: Infer,
    defaultRequest?: Partial<ImagePromptContext<Together, AddCtx>> | undefined,
  ) => (
    ...args: IfNever<
      ExtractPlaceholders<TemplateString>,
      [context?: Partial<ImagePromptContext<Together, AddCtx>> | undefined],
      [
        templateArgs: TemplateArgs<
          ExtractPlaceholders<TemplateString>
        >,
        context?: Partial<ImagePromptContext<Together, AddCtx>> | undefined,
      ]
    >
  ) => Promise<Awaited<ReturnType<Infer>>>;
  mergeContext: (
    params: InferenceParams<ImagePromptContext<Together, AddCtx>>,
  ) => ImagePromptContext<Together, AddCtx>;
  inferImageRaw: (
    renderedTemplate: string,
    { body, options }: ImagePromptContext<Together, AddCtx>,
  ) => Promise<(string | undefined)[]>;
  inferImage: (
    params: InferenceParams<ImagePromptContext<Together, AddCtx>>,
  ) => Promise<(string | undefined)[]>;
  respondWithImage: (
    format?: "url" | "b64_json",
  ) => (
    params: InferenceParams<ImagePromptContext<Together, AddCtx>>,
  ) => Promise<(string | undefined)[]>;
};
