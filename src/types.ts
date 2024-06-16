import { z } from 'zod'

const toolTypeSchema = z.literal('function')

export type FunctionTool = z.infer<typeof functionToolSchema>
export const functionToolSchema = z.object({
  name: z.string(),
  // TODO(duane): make arguments non-optional--only humanloop thinks its optional, openai doesn't
  arguments: z.string().optional(),
})

export type ToolCall = z.infer<typeof toolCallSchema>
export const toolCallSchema = z.object({
  id: z.string(),
  type: toolTypeSchema,
  function: functionToolSchema,
})

export type ChatRole = z.infer<typeof chatRoleSchema>
export const chatRoleSchema = z.enum(['user', 'assistant', 'system', 'tool'])

export type ChatMessageImageAttachment = z.infer<
  typeof chatMessageImageAttachmentSchema
>
export const chatMessageImageAttachmentSchema = z.object({
  type: z.literal('image'), // consider adding more types such as 'video', 'audio', 'file'
  title: z.string(),
  imageUrl: z.string(), // this is the cloudflare R2 URL
})

export type ChatMessageDocumentAttachment = z.infer<
  typeof chatMessageImageAttachmentSchema
>
export const chatMessageDocumentAttachmentSchema = z.object({
  type: z.literal('document'),
  title: z.string(),
})

export type ChatMessageAttachment = z.infer<typeof chatMessageAttachmentSchema>
export const chatMessageAttachmentSchema = z.discriminatedUnion('type', [
  chatMessageImageAttachmentSchema,
  chatMessageDocumentAttachmentSchema,
])

export type ChatMessage = z.infer<typeof chatMessageSchema>
export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string(),
  attachments: z.array(chatMessageAttachmentSchema).nullish(),
  name: z.string().nullish(),
  tool_call_id: z.string().nullish(),
  tool_calls: z.array(toolCallSchema).nullish(),
})

export type ChatCompletion = z.infer<typeof chatCompletionSchema>
export const chatCompletionSchema = z.object({
  // The completion message made by a model
  message: chatMessageSchema,

  // Why did the model return with a message?
  finishReason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']),

  // Number of tokens in the completion message
  tokens: z.number().optional(),
})

export const modelConfigBaseSchema = z.object({
  // Response format expected of the model
  responseFormat: z.enum(['natural', 'json']).default('natural'),

  // Model parameters
  stop: z.string().optional(),
  seed: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
})

export type ModelConfig = z.infer<typeof modelConfigSchema>
export const modelConfigSchema = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('openai'),
      model: z.enum(['gpt-3.5-turbo']),
    })
    .merge(modelConfigBaseSchema),
])

export type ChatRequest = z.infer<typeof chatRequestSchema>
export const chatRequestSchema = z.object({
  // Message history to send as part of the chat request
  messages: z.array(chatMessageSchema),

  // ModelConfig, including model and parameters
  modelConfig: modelConfigSchema,

  // The prompt project ID (originally Humanloop project ID)
  projectId: z.string().optional(),

  // If the modelConfig's template has placeholders, we need inputs to interpolate into those placeholders
  inputs: z.record(z.string()).optional(),

  // Number of tokens in the request messages
  tokens: z.number().optional(),

  // Equivalent to Humanloop's session_reference_id
  traceId: z.string().optional(),

  // Identifies where the model was called from
  source: z.enum(['space']).optional(),

  // Optional tracking of which user made the request
  userId: z.string().optional(),

  // Optional ability to set the tool choice
  toolChoice: z
    .union([
      z.literal('auto'),
      z.literal('required'),
      z.object({
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
        }),
      }),
      z.literal('none'),
    ])
    .optional(),
})
