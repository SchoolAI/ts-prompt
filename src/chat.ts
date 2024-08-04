// import { AIClient } from './ai'
// import {
//   OpenAIChatCompletion,
//   OpenAIChatCompletionCreateParams,
//   OpenAIChatCompletionMessageParam,
// } from './openai'
// import { ChatCompletion, ChatMessage, ChatRequest, ModelConfig } from './types'

// // function buildGPT4oContent(message: ChatMessage) {
// //   const attachments = message.attachments
// //     ? message.attachments
// //         .filter((a): a is ChatMessageImageAttachment => a.type === 'image')
// //         .map(attachment => ({
// //           type: 'image_url' as const,
// //           image_url: {
// //             url: attachment.imageUrl || '',
// //           },
// //         }))
// //     : []
// //   return [
// //     {
// //       type: 'text' as const,
// //       text: message.content,
// //     },
// //     ...attachments,
// //   ]
// // }

// const chatMessagesToOpenAIChatMessages = (
//   messages: ChatMessage[],
// ): OpenAIChatCompletionMessageParam[] => {
//   return messages.map(m => {
//     // const useGPT4o = attachmentHasImages(m.attachments)
//     switch (m.role) {
//       case 'system':
//         return { role: 'system' as const, content: m.content }
//       case 'user':
//         return {
//           role: 'user' as const,
//           // content: useGPT4o ? buildGPT4oContent(m) : m.content,
//           content: m.content,
//         }
//       case 'assistant':
//         return {
//           role: 'assistant' as const,
//           content: m.content,
//           tool_calls: m.toolCalls
//             ? m.toolCalls.map(tc => ({
//                 id: tc.id,
//                 type: 'function',
//                 function: {
//                   name: tc.function.name,
//                   arguments: tc.function.arguments ?? '',
//                 },
//               }))
//             : undefined,
//         }
//       case 'tool': {
//         const tool_call_id = m.toolCallId
//         if (!tool_call_id) throw new Error('tool call id required')
//         return {
//           role: 'tool' as const,
//           content: m.content,
//           tool_call_id,
//         }
//       }
//     }
//   })
// }

// export const openAiChatCompletionToChatCompletion = (
//   chatCompletion: OpenAIChatCompletion,
// ): ChatCompletion => {
//   const firstChoice = chatCompletion.choices[0]

//   if (!firstChoice) {
//     throw new Error('No chat completion choices')
//   }

//   return {
//     message: {
//       role: firstChoice.message.role, // always "assistant" according to OpenAI docs
//       content: firstChoice.message.content ?? '',
//       tool_calls: firstChoice.message.tool_calls,
//     },
//     finishReason:
//       firstChoice.finish_reason === 'function_call'
//         ? 'stop'
//         : firstChoice.finish_reason,
//     tokens: chatCompletion.usage?.total_tokens,
//   }
// }

// const responseFormatToOpenAiResponseFormat = (
//   responseFormat: ModelConfig['responseFormat'],
// ): OpenAIChatCompletionCreateParams['response_format'] => {
//   switch (responseFormat) {
//     case 'json':
//       return {
//         type: 'json_object',
//       }
//     default:
//       return undefined
//   }
// }

// const chatRequestToOpenAiChatCompletionParams = (
//   request: ChatRequest,
// ): OpenAIChatCompletionCreateParams => {
//   return {
//     messages: chatMessagesToOpenAIChatMessages(request.messages),
//     model: request.modelConfig.model,
//     // tools:
//     //   request.tools.length > 0
//     //     ? request.modelConfig.tools.map(t => ({
//     //         type: 'function',
//     //         function: {
//     //           name: t.name,
//     //           parameters: t.parameters,
//     //         },
//     //       }))
//     //     : undefined,
//     // tool_choice: request.toolChoice as OpenAIChatCompletionToolChoiceOption,
//     user: request.userId,
//     frequency_penalty: request.modelConfig.frequencyPenalty,
//     temperature: request.modelConfig.temperature,
//     stop: request.modelConfig.stop,
//     seed: request.modelConfig.seed,
//     response_format: responseFormatToOpenAiResponseFormat(
//       request.modelConfig.responseFormat,
//     ),
//     top_p: request.modelConfig.topP,
//   }
// }

// // createChatCompletion2: THE FUTURE is almost here!
// //
// // Like createChatCompletion, but takes our ChatRequest as input rather than Humanloop's
// // ChatRequest and returns our ChatCompletion rather than OpenAI's ChatCompletion
// export const createChatCompletion2 = async (
//   ai: AIClient,
//   request: ChatRequest,
// ): Promise<ChatCompletion> => {
//   const openAiChatCompletionParams =
//     chatRequestToOpenAiChatCompletionParams(request)

//   const openAiCompletion = await ai.openai.chat.completions.create({
//     ...openAiChatCompletionParams,
//     stream: false,
//   })

//   return openAiChatCompletionToChatCompletion(openAiCompletion)
// }

// function attachmentHasImages(attachments: ChatMessage['attachments']): boolean {
//   return (
//     (attachments?.length !== 0 && attachments?.some(a => a.type === 'image')) ||
//     false
//   )
// }
