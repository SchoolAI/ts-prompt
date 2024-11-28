import {
  type ExtractPlaceholders,
  type IfNever,
  Template,
} from "./template.ts";

export type TemplateArgs<P extends string> = { [key in P]: string };

export type InferenceParams<X, P extends string> = {
  templateArgs: TemplateArgs<P> | undefined;
  renderedTemplate: string;
  builderRequest: X;
  promptRequest: Partial<X> | undefined;
  request: X;
};

/**
 * The type signature of an "inference" function. An inference function is an adapter that takes
 * a rendered template string and a request object, and returns a promise of the inferred output.
 *
 * Normally, you don't need to use this type directly. Instead, use the `initPromptBuilder`, and
 * one of the `respondeWith*` (`respondWithText`, `respondWithJson`, etc.) functions to create a
 * prompt.
 *
 * See the `openai.ts` and `together.ts` examples for more information.
 */
export type InferenceFn<X, P extends string, O> = ({
  templateArgs,
  renderedTemplate,
  builderRequest,
  promptRequest,
  request,
}: InferenceParams<X, P>) => Promise<O>;

/**
 * The main function to create a prompt. This function is curried, and the first call creates a
 * prompt builder, which is then used to create individual prompts.
 *
 * ```ts
 * const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
 *
 * const { respondWithImage, respondWithText, respondWithJson } =
 *   buildInferenceFunctionsForOpenAI(openai);
 *
 * const buildPrompt = initPromptBuilder<
 *   ChatRequest<ChatCompletionCreateParamsNonStreaming>
 * >({
 *   messages: [],
 *   model: "gpt-4o",
 * });
 *
 * // Finally, create an actual prompt with a template string and an inference function
 * const requestContent = buildPrompt(`
 *     You are an AI Assistant for teachers. Respond in the language {{language}}.
 *   `,
 *   respondWithText()
 * )
 * ```
 */
export const initPromptBuilder = <X>(
  defaultBuilderRequest: X,
): PromptBuilder<X> => {
  return <
    S extends string,
    F extends InferenceFn<X, ExtractPlaceholders<S>, any>,
  >(
    template: S,
    infer: F,
    defaultPromptRequest?: Partial<X>,
  ) => {
    type P = ExtractPlaceholders<S>;

    const tpl = Template.build(template);

    const promptFn: PromptFn<X, S, F> = async (...args) => {
      if (tpl.placeholders.length === 0) {
        const [request] = args;
        const renderedTemplate = tpl.render(undefined);
        const mergedRequest = {
          ...defaultBuilderRequest,
          ...defaultPromptRequest,
          ...request,
        };
        return await infer({
          templateArgs: undefined,
          renderedTemplate,
          builderRequest: defaultBuilderRequest,
          promptRequest: defaultPromptRequest,
          request: mergedRequest,
        });
      } else {
        const [templateArgs, request] = args;
        if (!templateArgs) {
          throw new Error(
            "Template has placeholders, so template args are required",
          );
        }
        const renderedTemplate = tpl.render(
          templateArgs as IfNever<P, undefined, TemplateArgs<P>>,
        );
        return await infer({
          templateArgs: templateArgs as TemplateArgs<P>,
          renderedTemplate,
          builderRequest: defaultBuilderRequest,
          promptRequest: defaultPromptRequest,
          request: {
            ...defaultBuilderRequest,
            ...defaultPromptRequest,
            ...request,
          },
        });
      }
    };

    return promptFn;
  };
};

// Helper types

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<X, P extends string> = IfNever<
  P,
  [request?: Partial<X>],
  [templateArgs: TemplateArgs<P>, request?: Partial<X>]
>;

type PromptBuilder<X> = <
  S extends string,
  F extends InferenceFn<X, ExtractPlaceholders<S>, any>,
>(
  template: S,
  infer: F,
  defaultRequest?: Partial<X>,
) => PromptFn<X, S, F>;

type PromptFn<
  X,
  S extends string,
  F extends InferenceFn<X, ExtractPlaceholders<S>, any>,
> = (
  ...args: PromptRequestArgs<X, ExtractPlaceholders<S>>
) => Promise<Awaited<ReturnType<F>>>;
