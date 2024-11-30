import {
  type ExtractPlaceholders,
  type IfNever,
  Template,
} from "^/template.ts";

export type TemplateArgs<TemplateString extends string> = {
  [key in TemplateString]: string;
};

export type InferenceParams<Ctx, TemplateString extends string = string> = {
  templateArgs: TemplateArgs<TemplateString> | undefined;
  renderedTemplate: string;
  contextFromBuilder: Ctx;
  contextFromPrompt: Partial<Ctx> | undefined;
  contextFromRequest: Partial<Ctx> | undefined;
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
export type InferenceFn<Ctx, TemplateString extends string, O> = ({
  templateArgs,
  renderedTemplate,
  contextFromBuilder,
  contextFromPrompt,
  contextFromRequest,
}: InferenceParams<Ctx, TemplateString>) => Promise<O>;

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
export const initPromptBuilder = <Ctx>(
  contextFromBuilder: Ctx,
): PromptBuilder<Ctx> => {
  return <
    TemplateString extends string,
    Infer extends InferenceFn<Ctx, ExtractPlaceholders<TemplateString>, any>,
  >(
    template: TemplateString,
    infer: Infer,
    contextFromPrompt?: Partial<Ctx>,
  ) => {
    type P = ExtractPlaceholders<TemplateString>;

    const tpl = Template.build(template);

    const promptFn: PromptFn<Ctx, TemplateString, Infer> = async (...args) => {
      if (tpl.placeholders.length === 0) {
        const [contextFromRequest] = args as [Partial<Ctx> | undefined];

        const renderedTemplate = tpl.render(undefined);

        return await infer({
          templateArgs: undefined,
          renderedTemplate,
          contextFromBuilder,
          contextFromPrompt,
          contextFromRequest,
        });
      } else {
        const [templateArgs, contextFromRequest] = args;

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
          contextFromBuilder,
          contextFromPrompt,
          contextFromRequest,
        });
      }
    };

    return promptFn;
  };
};

// Helper types

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptParams<Ctx, TemplateString extends string> = IfNever<
  TemplateString,
  [context?: Partial<Ctx>],
  [templateArgs: TemplateArgs<TemplateString>, context?: Partial<Ctx>]
>;

type PromptBuilder<Ctx> = <
  TemplateString extends string,
  Infer extends InferenceFn<Ctx, ExtractPlaceholders<TemplateString>, any>,
>(
  template: TemplateString,
  infer: Infer,
  defaultRequest?: Partial<Ctx>,
) => PromptFn<Ctx, TemplateString, Infer>;

type PromptFn<
  Ctx,
  TemplateString extends string,
  Infer extends InferenceFn<Ctx, ExtractPlaceholders<TemplateString>, any>,
> = (
  ...args: PromptParams<Ctx, ExtractPlaceholders<TemplateString>>
) => Promise<Awaited<ReturnType<Infer>>>;
