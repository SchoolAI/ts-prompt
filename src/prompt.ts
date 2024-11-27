import {
  type ExtractPlaceholders,
  type IfNever,
  Template,
} from "./template.ts";

type TemplateArgs<P extends string> = { [key in P]: string };

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<X, P extends string> = IfNever<
  P,
  [request?: Partial<X>],
  [templateArgs: TemplateArgs<P>, request?: Partial<X>]
>;

export type InferenceFn<X, O> = ({
  renderedTemplate,
  request,
}: {
  renderedTemplate: string;
  request: X;
}) => Promise<O>;

type InferenceWithArgsFn<X, P extends string, O> = ({
  templateArgs,
  renderedTemplate,
  request,
}: {
  templateArgs: TemplateArgs<P> | undefined;
  renderedTemplate: string;
  request: X;
}) => Promise<O>;

type PromptBuilder<X> = <
  S extends string,
  F extends InferenceWithArgsFn<X, ExtractPlaceholders<S>, any>,
>(
  template: S,
  infer: F,
  defaultRequest?: Partial<X>,
) => (
  ...args: PromptRequestArgs<X, ExtractPlaceholders<S>>
) => Promise<Awaited<ReturnType<F>>>;

export const initPromptBuilder = <X = undefined>(
  defaultBuilderRequest: X,
): PromptBuilder<X> => {
  return <
    S extends string,
    F extends InferenceWithArgsFn<X, ExtractPlaceholders<S>, any>,
  >(
    template: S,
    infer: F,
    defaultPromptRequest?: Partial<X>,
  ) => {
    type P = ExtractPlaceholders<S>;

    const tpl = Template.build(template);

    return async (
      ...args: PromptRequestArgs<X, P>
    ): Promise<Awaited<ReturnType<F>>> => {
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
          request: {
            ...defaultBuilderRequest,
            ...defaultPromptRequest,
            ...request,
          },
        });
      }
    };
  };
};
