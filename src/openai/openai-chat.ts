import type { z, ZodType } from "zod";
import { zodResponseFormat } from "npm:openai@4.73.1/helpers/zod";
import { JSON_PROMPT, stringToJsonSchema } from "^/json.ts";
import { type MergeMessagesFn, mergeMessagesTop } from "^/merge.ts";
import type { InferenceParams } from "^/prompt.ts";

type ChatCompletionCreateParamBody<Message> = {
  messages: Message[];
  model: string;
  response_format?: any;
};

export type OpenAIInterface<Message> = {
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
    message: {
      content: string | null;
      role: "assistant";
    };
  }[];
};

type ChatCompletionCreateResult<
  Message,
  OpenAI extends OpenAIInterface<Message>,
> = Awaited<
  ReturnType<OpenAI["chat"]["completions"]["create"]>
>["choices"][number];

export type ChatPromptContext<
  Message,
  OpenAI extends OpenAIInterface<Message>,
> = {
  body: Omit<
    Parameters<OpenAI["chat"]["completions"]["create"]>[0],
    "messages"
  >;
  options?: Parameters<OpenAI["chat"]["completions"]["create"]>[1];
  messages?: Message[];
  mergeMessages?: MergeMessagesFn<Message>;
};

export type Types<Message, OpenAI extends OpenAIInterface<Message>> = {
  context: ChatPromptContext<Message, OpenAI>;
  result: ChatCompletionCreateResult<Message, OpenAI>;
  inferenceParams: InferenceParams<ChatPromptContext<Message, OpenAI>>;
};

/**
 * OpenAI's vendored zodToJsonSchema function.
 */
export const zodToJsonSchema = (
  schema: ZodType,
): Record<string, unknown> | undefined =>
  zodResponseFormat(schema, "result").json_schema.schema;

/**
 * Builds inference functions for an OpenAI client.
 *
 * @param openai The OpenAI client. You can import and pass any version that conforms to the
 *        type expectations.
 */
export const buildChatInferenceFunctionsForOpenAI = <
  Message,
  OpenAI extends OpenAIInterface<Message>,
  T extends Types<Message, OpenAI>,
>(
  openai: OpenAI,
) => {
  const mergeChatContext = (params: T["inferenceParams"]): T["context"] => {
    return {
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
      messages:
        // deno-fmt-ignore
        params.contextFromRequest?.messages ??
        params.contextFromPrompt?.messages ??
        params.contextFromBuilder.messages,
      mergeMessages:
        // deno-fmt-ignore
        params.contextFromRequest?.mergeMessages ??
        params.contextFromPrompt?.mergeMessages ??
        params.contextFromBuilder.mergeMessages,
    };
  };

  const mergeChatContextAndMessages = (
    params: T["inferenceParams"],
  ): T["context"] => {
    // First, merge the context from the builder, prompt, and request
    const context = mergeChatContext(params);

    // Determine how to merge the rendered template with messages
    const mergeMessages = context.mergeMessages ?? mergeMessagesTop;

    // Convert the rendered template into a system message and merge it in
    const messages = mergeMessages(
      params.renderedTemplate,
      context.messages ?? [],
      (content) => ({ content, role: "system" } as Message),
    );

    // Return a new context that includes the merged messages
    return {
      ...context,
      messages,
    };
  };

  const inferChatRaw = async (
    messages: Message[],
    { body, options }: T["context"],
  ): Promise<T["result"]> => {
    const result = await openai.chat.completions.create(
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
    return await inferChatRaw(context.messages ?? [], context);
  };

  const inferJson = async <
    Schema extends ZodType,
  >(
    schema: Schema,
    params: T["inferenceParams"],
  ): Promise<z.infer<Schema>> => {
    const context = mergeChatContextAndMessages({
      ...params,
      renderedTemplate: params.renderedTemplate + "\n" + JSON_PROMPT,
    });

    const result = await inferChatRaw(context.messages ?? [], {
      ...context,
      body: {
        ...context.body,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "schema",
            schema: zodToJsonSchema(schema),
            strict: true,
          },
        },
      },
    });

    return stringToJsonSchema.pipe(schema).parse(result.message.content);
  };

  const respondWithChoice = () => async (params: T["inferenceParams"]) =>
    await inferChoice(params);

  const respondWithText = () => async (params: T["inferenceParams"]) =>
    (await inferChoice(params)).message.content;

  const respondWithJson =
    <Schema extends ZodType>(schema: Schema) =>
    (params: T["inferenceParams"]) => inferJson(schema, params);

  return {
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
