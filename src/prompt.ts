import { ExtractPlaceholders, IfNever, Template } from './template.js'

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<C, X, P extends string> = IfNever<
  P,
  { request: X; config?: C },
  { request: X; config?: C; templateArgs: { [key in P]: string } }
>

export type InferenceFn<C, X, O> = ({
  renderedTemplate,
  request,
  config,
}: {
  renderedTemplate: string
  request: X
  config: C
}) => Promise<O>

export const initPromptBuilder = <C, X = undefined>(
  defaultBuilderConfig: C,
) => {
  return <S extends string, F extends InferenceFn<C, X, any>>(
    template: S,
    infer: F,
    defaultPromptConfig?: Partial<C>,
  ) => {
    type P = ExtractPlaceholders<S>
    type PlaceholderArgs = IfNever<P, undefined, { [key in P]: string }>

    const tpl = Template.build(template)

    return async (
      args: PromptRequestArgs<Partial<C>, X, P>,
    ): Promise<Awaited<ReturnType<F>>> => {
      if (tpl.placeholders.length === 0) {
        const { request, config } = args
        const renderedTemplate = tpl.render(undefined)
        return await infer({
          renderedTemplate,
          request,
          config: {
            ...defaultBuilderConfig,
            ...defaultPromptConfig,
            ...config,
          },
        })
      } else {
        const { request, config } = args
        if (!('templateArgs' in args)) {
          throw new Error(
            'Template has placeholders, so template args are required',
          )
        }
        const renderedTemplate = tpl.render(
          args.templateArgs as PlaceholderArgs,
        )
        return await infer({
          renderedTemplate,
          request,
          config: {
            ...defaultBuilderConfig,
            ...defaultPromptConfig,
            ...config,
          },
        })
      }
    }
  }
}
