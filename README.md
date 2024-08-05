# ts-prompt

`ts-prompt` is a simple typescript library for constructing typesafe prompts for LLMs. Its inputs
(template placeholders), and outputs (zod-parsed results) are guaranteed to be correctly typed
so that code changes and prompt changes cannot get out of sync. The patterns in this library were
extracted from SchoolAI's large, working codebase and agentic system. It is provider-agnostic, but
works well with OpenAI.

Note that it is not possible to take advantage of `ts-prompt` if prompts are stored in a database--
the prompts must be stored in the code itself so that typescript's powerful engine can extract any
placeholders in the prompt template and create type consistency across the codebase.

## Example

```typescript
// inferred type:
//
// JsonPrompt<ModelConfig, "language", {
//     name: string | null;
//     subject: string | null;
//     duration: string | null;
//     keyTopics: string[];
//     targetAudience: string | null;
// }>
const prompt = mkPrompt({
  template: `
    You are an educational consultant. Extract the course or lesson name, subject, duration,
    key topics, and target audience. If information is not available, do not make up details--
    instead, report as null (or empty array if appropriate).

    Record your findings in the natural language {{language}}.
  `,
  returns: z.object({
    name: z.string().nullable().describe('The name of the course or lesson.'),
    subject: z.string().nullable().describe('The subject of the course or lesson.'),
    duration: z.string().nullable().describe('The duration of the course or lesson.'),
    keyTopics: z.array(z.string()).describe('The key topics covered in the course or lesson.'),
    targetAudience: z.string().nullable().describe('The target audience for the course or lesson.'),
  }),
})

// Note: the `prompt` object above has type `Prompt<"language">` and enforces that all
// requests (e.g. `requestJson` below) pass in a `language` parameter. It also enforces
// that the response from the LLM is a JSON object that `returns` the correct shape and
// types, parsed by the zod schema provided. The result is guaranteed to be typed
// correctly (or an error will be thrown).

// Request the AI to provide a response
const details = await prompt.requestJson({
  timeline: [
    {
      role: 'user',
      content: `
        The kindergarten class will be learning about the life cycle of a butterfly. The topic will
        cover the different stages from egg, to caterpillar, to chrysalis, and finally to
        butterfly. The lesson will include hands-on activities such as observing live caterpillars
        and creating butterfly crafts. The target audience for this lesson is young children aged
        4-6 years old.
      `
    }
  ],
  params: { language: 'English' },
})

// Note: in this example, the user message will be appended by default to the system message,
// before it is sent to the LLM for inference. But this is flexible--you can arrange or
// rearrange the timeline however you need. See `joinTimeline` in the `initPrompt` function.

console.log(details)
// {
//   name: "The Life Cycle of a Butterfly",
//   subject: "Biology",
//   duration: "1 hour",
//   keyTopics: ["egg", "caterpillar", "chrysalis", "butterfly", "hands-on activities"],
//   targetAudience: "young children aged 4-6 years old",
// }
```

## How to Use `ts-prompt`

`ts-prompt` is very flexible around what inference engine or LLM it uses, how it logs information,
and what kind of model config it uses. In order to have this much flexibility, the first thing
you need to create is an `mkPrompt` function:

```typescript
import { OpenAI } from 'openai';
import { initPrompt, initOpenAIGetChatCompletion } from 'ts-prompt';

// Initialize OpenAI client with API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Function to get chat completion
const getChatCompletion = initOpenAIGetChatCompletion(openai);

// Initialize the mkPrompt function with default configuration
const mkPrompt = initPrompt(getChatCompletion, {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
});

// now use `mkPrompt` to define your typesafe prompts...
```

You can create your own `getChatCompletion` function if you want to use a different inference
engine, or if you need special logging, tracking, retry logic, etc.

In addition, while the default OpenAI `getChatCompletion` and `mkPrompt` functions use a suggested
`ModelConfig` type to describe the model parameters, you can create your own type as long as it
extends `ModelConfigBase`. This can be useful if, for example, you need more parameters for your
model or need to pass individualized information like userId.
