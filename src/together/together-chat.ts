import type { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  JSON_PROMPT,
  makeJsonTemplateString,
  stringToJsonSchema,
} from "^/json.ts";
import { type MergeMessagesFn, mergeMessagesTop } from "^/merge.ts";
import {
  type InferenceFn,
  type InferenceParams,
  initPromptBuilder,
  type TemplateArgs,
} from "^/prompt.ts";
import type { ExtractPlaceholders, IfNever } from "^/template.ts";

const jsonModeSupportedModels = [
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "mistralai/Mistral-7B-Instruct-v0.1 ",
];

type ChatCompletionCreateParamBody<Message> = {
  model: string;
  messages: Message[];
  response_format?: any;
};

type TogetherInterface<Message> = {
  chat: {
    completions: {
      create(
        body: ChatCompletionCreateParamBody<Message>,
        options?: any,
      ): Promise<Completion>;
    };
  };
};

type Completion = {
  choices: {
    message?: {
      content: string | null;
      role: "assistant";
    };
  }[];
};

type ChatCompletionCreateResult<
  Message,
  Together extends TogetherInterface<Message>,
> = Awaited<
  ReturnType<Together["chat"]["completions"]["create"]>
>["choices"][number];

/**
 * The type of the context object that is passed to the prompt builder and inference functions.
 */
export type ChatPromptContext<
  Message,
  Together extends TogetherInterface<Message>,
  AddCtx,
> = {
  body: Omit<
    Parameters<Together["chat"]["completions"]["create"]>[0],
    "messages"
  >;
  options?: Parameters<Together["chat"]["completions"]["create"]>[1];
  messages?: Message[];
  mergeMessages?: MergeMessagesFn<Message>;
} & AddCtx;

type Types<
  Message,
  Together extends TogetherInterface<Message>,
  AddCtx,
> = {
  context: ChatPromptContext<Message, Together, Partial<AddCtx>>;
  result: ChatCompletionCreateResult<Message, Together>;
  inferenceParams: InferenceParams<
    ChatPromptContext<Message, Together, Partial<AddCtx>>
  >;
};

/**
 * Builds inference functions for an OpenAI client.
 *
 * @param together The OpenAI client. You can import and pass any version that conforms to the
 *        type expectations.
 */
export const buildChatFunctions: BuildChatFunctions = <
  Together extends TogetherInterface<Message>,
  AddCtx,
  Message = unknown,
>(together: Together) => {
  type T = Types<Message, Together, AddCtx>;

  const initChatPromptBuilder = initPromptBuilder<T["context"]>;

  const mergeChatContext = (params: T["inferenceParams"]): T["context"] => {
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
      // deno-fmt-ignore
      messages:
          params.contextFromRequest?.messages ??
          params.contextFromPrompt?.messages ??
          params.contextFromBuilder.messages,
      // deno-fmt-ignore
      mergeMessages:
          params.contextFromRequest?.mergeMessages ??
          params.contextFromPrompt?.mergeMessages ??
          params.contextFromBuilder.mergeMessages,
    };
  };

  const mergeRenderedTemplate = (
    renderedTemplate: string,
    context: T["context"],
  ): T["context"] => {
    // Determine how to merge the rendered template with messages
    const mergeMessages = context.mergeMessages ?? mergeMessagesTop;

    // Convert the rendered template into a system message and merge it in
    const messages = mergeMessages(
      renderedTemplate,
      context.messages ?? [],
      (content) => ({ content, role: "system" } as Message),
    );

    // Return a new context that includes the merged messages
    return {
      ...context,
      messages,
    };
  };

  const mergeChatContextAndMessages = (
    params: T["inferenceParams"],
  ): T["context"] => {
    return mergeRenderedTemplate(
      params.renderedTemplate,
      mergeChatContext(params),
    );
  };

  const inferChatRaw = async (
    messages: Message[],
    { body, options }: T["context"],
  ): Promise<T["result"]> => {
    const result = await together.chat.completions.create(
      { ...body, messages },
      options,
    );

    const firstChoice = result.choices[0];
    if (!firstChoice) throw new Error("no completion results");

    return firstChoice;
  };

  const inferChoice = async (
    params: T["inferenceParams"],
  ): Promise<T["result"]> => {
    const context = mergeChatContextAndMessages(params);
    return await inferChatRaw(
      context.messages ?? [],
      context,
    );
  };

  const inferJson = async <
    Schema extends ZodType,
  >(
    schema: Schema,
    params: T["inferenceParams"],
  ): Promise<z.infer<Schema>> => {
    const initialContext = mergeChatContext(params);

    let choice;
    if (jsonModeSupportedModels.includes(initialContext.body.model)) {
      // For models that support JSON mode, we'll use the JSON schema directly
      // deno-fmt-ignore
      const renderedWithJsonInstructions =
        params.renderedTemplate + "\n" + JSON_PROMPT;

      const context = mergeRenderedTemplate(
        renderedWithJsonInstructions,
        initialContext,
      );

      choice = await inferChatRaw(context.messages ?? [], {
        ...context,
        body: {
          ...context.body,
          response_format: {
            type: "json_object",
            schema: zodToJsonSchema(schema),
          },
        },
      });
    } else {
      // For models that don't support JSON mode, we'll include the JSON schema in the prompt
      // deno-fmt-ignore
      const renderedWithJsonInstructions =
        params.renderedTemplate + "\n" + makeJsonTemplateString(schema);

      const context = mergeRenderedTemplate(
        renderedWithJsonInstructions,
        initialContext,
      );

      choice = await inferChatRaw(
        context.messages ?? [],
        context,
      );
    }

    return stringToJsonSchema.pipe(schema).parse(choice.message?.content);
  };

  const respondWithChoice = () => async (params: T["inferenceParams"]) =>
    await inferChoice(params);

  const respondWithText = () => async (params: T["inferenceParams"]) =>
    (await inferChoice(params)).message?.content;

  const respondWithJson =
    <Schema extends ZodType>(schema: Schema) =>
    (params: T["inferenceParams"]) => inferJson(schema, params);

  return {
    initChatPromptBuilder,
    mergeChatContext,
    mergeChatContextAndMessages,
    inferChatRaw,
    inferChoice,
    inferJson,
    respondWithChoice,
    respondWithText,
    respondWithJson,
  };
};

type BuildChatFunctions = <
  Together extends TogetherInterface<Message>,
  AddCtx,
  Message = unknown,
>(together: Together) => {
  initChatPromptBuilder: (
    contextFromBuilder: ChatPromptContext<Message, Together, Partial<AddCtx>>,
  ) => <
    TemplateString extends string,
    Infer extends InferenceFn<
      ChatPromptContext<Message, Together, Partial<AddCtx>>,
      ExtractPlaceholders<TemplateString>,
      any
    >,
  >(
    template: TemplateString,
    infer: Infer,
    defaultRequest?:
      | Partial<ChatPromptContext<Message, Together, Partial<AddCtx>>>
      | undefined,
  ) => (
    ...args: IfNever<
      ExtractPlaceholders<TemplateString>,
      [
        context?:
          | Partial<ChatPromptContext<Message, Together, Partial<AddCtx>>>
          | undefined,
      ],
      [
        templateArgs: TemplateArgs<
          ExtractPlaceholders<TemplateString>
        >,
        context?:
          | Partial<ChatPromptContext<Message, Together, Partial<AddCtx>>>
          | undefined,
      ]
    >
  ) => Promise<Awaited<ReturnType<Infer>>>;
  mergeChatContext: (
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => ChatPromptContext<Message, Together, Partial<AddCtx>>;
  mergeChatContextAndMessages: (
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => ChatPromptContext<Message, Together, Partial<AddCtx>>;
  inferChatRaw: (
    messages: Message[],
    { body, options }: ChatPromptContext<Message, Together, Partial<AddCtx>>,
  ) => Promise<ChatCompletionCreateResult<Message, Together>>;
  inferChoice: (
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => Promise<ChatCompletionCreateResult<Message, Together>>;
  inferJson: <Schema extends ZodType>(
    schema: Schema,
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => Promise<z.infer<Schema>>;
  respondWithChoice: () => (
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => Promise<ChatCompletionCreateResult<Message, Together>>;
  respondWithText: () => (
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => Promise<string | null | undefined>;
  respondWithJson: <Schema extends ZodType>(
    schema: Schema,
  ) => (
    params: InferenceParams<
      ChatPromptContext<Message, Together, Partial<AddCtx>>
    >,
  ) => Promise<z.TypeOf<Schema>>;
};
