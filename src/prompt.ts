import {
  type ExtractPlaceholders,
  type IfNever,
  Template,
} from "./template.ts";

export type TemplateArgs<P extends string> = { [key in P]: string };

export type InferenceFn<X, P extends string, O> = ({
  templateArgs,
  renderedTemplate,
  builderRequest,
  promptRequest,
  request,
}: {
  templateArgs: TemplateArgs<P> | undefined;
  renderedTemplate: string;
  builderRequest: X;
  promptRequest: Partial<X> | undefined;
  request: X;
}) => Promise<O>;

export const initPromptBuilder = <X = undefined>(
  defaultBuilderRequest: X,
): PromptBuilder<X> => {
  return <
    S extends string,
    F extends PromptParams<X, S>["infer"],
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

type PromptParams<X, S extends string> = {
  template: S;
  infer: InferenceFn<X, ExtractPlaceholders<S>, any>;
  defaultRequest?: Partial<X>;
};

type PromptBuilder<X> = <
  S extends string,
  F extends PromptParams<X, S>["infer"],
>(
  template: S,
  infer: F,
  defaultRequest?: Partial<X>,
) => PromptFn<X, S, F>;

type PromptFn<
  X,
  S extends string,
  F extends PromptParams<X, S>["infer"],
> = (
  ...args: PromptRequestArgs<X, ExtractPlaceholders<S>>
) => Promise<Awaited<ReturnType<F>>>;
