import { ExtractPlaceholders, IfNever, Template } from './template'

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<C, X, P extends string> = IfNever<
  P,
  { context: X; config?: C },
  { context: X; config?: C; templateArgs: { [key in P]: string } }
>

export type InferenceFn<C, X, O> = ({
  renderedTemplate,
  context,
  config,
}: {
  renderedTemplate: string
  context: X
  config: C
}) => Promise<O>

export const initPromptBuilder = <C, X = undefined>(defaultConfig: C) => {
  return <S extends string, F extends InferenceFn<C, X, any>>(
    template: S,
    infer: F,
  ) => {
    type P = ExtractPlaceholders<S>
    type PlaceholderArgs = IfNever<P, undefined, { [key in P]: string }>

    const tpl = Template.build(template)

    return async (args: PromptRequestArgs<Partial<C>, X, P>) => {
      if (tpl.placeholders.length === 0) {
        const { context, config } = args
        const renderedTemplate = tpl.render(undefined)
        return await infer({
          renderedTemplate,
          context,
          config: { ...defaultConfig, ...config },
        })
      } else {
        const { context, config } = args
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
          context,
          config: {
            ...defaultConfig,
            ...config,
          },
        })
      }
    }
  }
}
