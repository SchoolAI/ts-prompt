import { ExtractParams, IfNever, Template } from './template'

// Params are only needed when the Template has placeholders, so use a conditional type
type PromptRequestArgs<I, P extends string> = IfNever<
  P,
  [config?: I],
  [params: { [key in P]: string }, config?: I]
>

export type InferenceFn<C, O> = (input: string, config?: C) => Promise<O>

export const createPrompt = <C>(defaultConfig: C) => {
  return <S extends string, F extends { [key: string]: InferenceFn<C, any> }>({
    template,
    functions,
  }: {
    template: S
    functions: F
  }) => {
    type P = ExtractParams<S>
    const tpl = Template.build(template)
    const entries = Object.entries(functions).map(([key, infer]) => {
      type Params = IfNever<P, undefined, { [key in P]: string }>
      const fn = async (...args: PromptRequestArgs<C, P>) => {
        if (args.length > 2) throw new Error('Too many arguments')

        if (tpl.placeholders.length === 0) {
          const [config] = args
          const content = tpl.render(undefined)
          return await infer(content, { ...defaultConfig, ...config })
        } else {
          const [params, config] = args
          if (!params) {
            throw new Error('Template has placeholders, so params are required')
          }
          const content = tpl.render(params as Params)
          return await infer(content, { ...defaultConfig, ...config })
        }
      }
      return [key, fn] as const
    })
    return Object.fromEntries(entries) as {
      [K in keyof F]: (
        ...args: PromptRequestArgs<Partial<C>, P>
      ) => ReturnType<F[K]>
    }
  }
}
