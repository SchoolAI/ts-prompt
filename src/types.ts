import { ZodType, z } from 'zod'

export interface ChatMessageImageAttachment
  extends z.infer<typeof chatMessageImageAttachmentSchema> {}
export const chatMessageImageAttachmentSchema = z.object({
  type: z.literal('image'), // consider adding more types such as 'video', 'audio', 'file'
  title: z.string(),
  imageUrl: z.string(),
})

export interface ChatMessageDocumentAttachment
  extends z.infer<typeof chatMessageImageAttachmentSchema> {}
export const chatMessageDocumentAttachmentSchema = z.object({
  type: z.literal('document'),
  title: z.string(),
})

export type ChatMessageAttachment = z.infer<typeof chatMessageAttachmentSchema>
export const chatMessageAttachmentSchema = z.discriminatedUnion('type', [
  chatMessageImageAttachmentSchema,
  chatMessageDocumentAttachmentSchema,
])

export interface ToolCall extends z.infer<typeof toolCallSchema> {}
export const toolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string(),
})

export interface ChatSystemMessage
  extends z.infer<typeof chatSystemMessageSchema> {}
export const chatSystemMessageSchema = z.object({
  role: z.literal('system'),
  name: z.string().optional(),
  content: z.string(),
})

export interface ChatAssistantMessage
  extends z.infer<typeof chatAssistantMessageSchema> {}
export const chatAssistantMessageSchema = z.object({
  role: z.literal('assistant'),
  name: z.string().optional(),
  content: z.string(),
  toolCalls: z.array(toolCallSchema).optional(),
})

export interface ChatUserMessage
  extends z.infer<typeof chatUserMessageSchema> {}
export const chatUserMessageSchema = z.object({
  role: z.literal('user'),
  name: z.string().optional(),
  content: z.string(),
  attachments: z.array(chatMessageAttachmentSchema).optional(),
})

export type ChatToolMessage = z.infer<typeof chatToolMessageSchema>
export const chatToolMessageSchema = z.object({
  role: z.literal('tool'),
  name: z.string().nullish(),
  content: z.string().nullish(),
  toolCallId: z.string().nullish(),
  toolCalls: z.array(toolCallSchema).nullish(),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>
export const chatMessageSchema = z.discriminatedUnion('role', [
  chatSystemMessageSchema,
  chatAssistantMessageSchema,
  chatUserMessageSchema,
  chatToolMessageSchema,
])

// Extract roles, i.e. system, assistant, user, tool
const chatMessageRoleLiterals = chatMessageSchema.options.map(
  o => o.shape.role.value,
)
export const chatRoleSchema = z.enum([
  chatMessageRoleLiterals[0]!,
  ...chatMessageRoleLiterals.slice(1),
])

export interface ChatCompletion extends z.infer<typeof chatCompletionSchema> {}
export const chatCompletionSchema = z.object({
  // The completion message made by a model
  message: chatMessageSchema,

  // Why did the model return with a message?
  finishReason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']),

  // Number of tokens in the completion message
  tokens: z.number().optional(),
})

export interface ModelConfigBase
  extends z.infer<typeof modelConfigBaseSchema> {}
export const modelConfigBaseSchema = z.object({
  // Response format expected of the model
  responseFormat: z.enum(['natural', 'json']).optional(),

  // Model parameters
  temperature: z.number().optional(),
  seed: z.number().optional(),
  stop: z.string().optional(),
  topP: z.number().optional(),
  maxTokens: z.number().optional(),
  frequencyPenalty: z.number().optional(),
})

export interface ChatRequest<M extends ModelConfigBase>
  extends Omit<z.infer<ReturnType<typeof chatRequestSchema>>, 'config'> {
  config: M
}
export const chatRequestSchema = <M extends ModelConfigBase>(
  modelConfigSchema: ZodType<M>,
) =>
  z.object({
    // ModelConfig, potentially including model and parameters
    config: modelConfigSchema,

    // Message history to send as part of the chat request
    messages: z.array(chatMessageSchema).default([]),
  })
