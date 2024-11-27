import {
  type ExtractPlaceholders,
  type IfNever,
  Template,
} from "./template.ts";

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<X, P extends string> = IfNever<
  P,
  { request?: Partial<X> },
  { request?: Partial<X>; templateArgs: { [key in P]: string } }
>;

export type InferenceFn<X, O> = ({
  renderedTemplate,
  request,
}: {
  renderedTemplate: string;
  request: X;
}) => Promise<O>;

type PromptBuilder<X> = <S extends string, F extends InferenceFn<X, any>>(
  template: S,
  infer: F,
  defaultRequest?: Partial<X>,
) => (
  args: PromptRequestArgs<X, ExtractPlaceholders<S>>,
) => Promise<Awaited<ReturnType<F>>>;

export const initPromptBuilder = <X = undefined>(
  defaultBuilderRequest: X,
): PromptBuilder<X> => {
  return <S extends string, F extends InferenceFn<X, any>>(
    template: S,
    infer: F,
    defaultPromptRequest?: Partial<X>,
  ) => {
    type P = ExtractPlaceholders<S>;
    type PlaceholderArgs = IfNever<P, undefined, { [key in P]: string }>;

    const tpl = Template.build(template);

    return async (
      args: PromptRequestArgs<Partial<X>, P>,
    ): Promise<Awaited<ReturnType<F>>> => {
      if (tpl.placeholders.length === 0) {
        const { request } = args;
        const renderedTemplate = tpl.render(undefined);
        const mergedRequest = {
          ...defaultBuilderRequest,
          ...defaultPromptRequest,
          ...request,
        };
        return await infer({
          renderedTemplate,
          request: mergedRequest,
        });
      } else {
        const { request } = args;
        if (!("templateArgs" in args)) {
          throw new Error(
            "Template has placeholders, so template args are required",
          );
        }
        const renderedTemplate = tpl.render(
          args.templateArgs as PlaceholderArgs,
        );
        return await infer({
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
