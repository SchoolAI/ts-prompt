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

export const createPrompt = <C, X = undefined>(defaultConfig: C) => {
  return <
    S extends string,
    F extends { [key: string]: InferenceFn<C, X, any> },
  >({
    template,
    functions,
  }: {
    template: S
    functions: F
  }) => {
    type P = ExtractPlaceholders<S>
    const tpl = Template.build(template)
    const entries = Object.entries(functions).map(([key, infer]) => {
      type PlaceholderArgs = IfNever<P, undefined, { [key in P]: string }>
      const fn = async (args: PromptRequestArgs<C, X, P>) => {
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
      return [key, fn] as const
    })
    return Object.fromEntries(entries) as {
      [K in keyof F]: (
        args: PromptRequestArgs<Partial<C>, X, P>,
      ) => ReturnType<F[K]>
    }
  }
}
