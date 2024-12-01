# ts-prompt

`ts-prompt` is a simple typescript library for constructing typesafe prompts for LLMs. Its inputs
(template arguments), and outputs (zod-parsed results) are guaranteed to be correctly typed so that
code changes and prompt changes cannot get out of sync. The patterns in this library were extracted
from SchoolAI's large, working codebase and agentic system. It is provider-agnostic, but works well
with OpenAI and TogetherAI.

Note that it is not possible to take advantage of template placeholders if prompts are stored in a
database--the prompts must be stored in the code itself so that typescript's powerful engine can
extract placeholders in the prompt template and create type consistency across the codebase.

## Example

```typescript
import { OpenAI } from "openai";
import { buildChatFunctions } from "ts-prompt/openai.ts";

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! })

const { initChatPromptBuilder, respondWithJson } = buildChatFunctions<OpenAI>(openai);

const buildPrompt = initChatPromptBuilder({ model: 'gpt-3.5-turbo' })

const courseMetadataPrompt = buildPrompt({
  template: `
    You are an educational consultant. Extract the course or lesson name,
    subject, duration, key topics, and target audience. If information is
    not available, do not make up details--instead, report as null (or
    empty array if appropriate).

    Record your findings in the natural language {{language}}.
  `,
  respondWithJson(
    z.object({
      name: z.string().nullable()
        .describe('The name of the course or lesson.'),
      subject: z.string().nullable()
        .describe('The subject of the course or lesson.'),
      duration: z.string().nullable()
        .describe('How long the course or lesson is, e.g. hours, days.'),
      keyTopics: z.array(z.string())
        .describe('The key topics covered in the course or lesson.'),
      targetAudience: z.string().nullable()
        .describe('The target audience for the course or lesson.'),
    })
  )
})

// Note: the async `courseMetadataPrompt` function above will require a
// `language` template arg to be passed in, enforced by typescript. It
// also enforces that the response from the LLM is a JSON object with the
// correct shape and types, parsed by the zod schema provided. The result
// is guaranteed to be typed correctly (or an error will be thrown).

// Request the AI to provide a response
const details = await courseMetadataPrompt(
  { language: 'English' },
  { messages: [
      {
        role: 'user',
        content: `
          The kindergarten class will be learning about the life cycle of a
          butterfly. The topic will cover the different stages from egg, to
          caterpillar, to chrysalis, and finally to butterfly. The lesson
          will include hands-on activities such as observing live caterpillars
          and creating butterfly crafts. The target audience for this lesson
          is young children aged 4-6 years old.
        `
      }
    ],
  },
)

// Note: in this example, the user message will be appended by default to
// the system message, before it is sent to the LLM for inference. But
// this is flexible--you can arrange or rearrange the timeline however
// you need. See the `respondWithJson` function for more info.

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
you need to create is a function that builds prompts, e.g. `buildPrompt` or `buildImagePrompt`
(you can name it what you like):

```typescript
import { OpenAI } from "openai";
import { buildImageFunctions } from "ts-prompt/together.ts";

// Initialize TogetherAI client with API key
const together = new Together({ apiKey: Deno.env.get("TOGETHER_API_KEY")! });

const { initImagePromptBuilder, respondWithImage } = buildImageFunctions<Together>(together);

// Initialize the `buildImagePrompt` function with default configuration
const buildImagePrompt = initImagePromptBuilder({
  model: "black-forest-labs/FLUX.1-schnell",
  width: 512,
  height: 512,
  response_format: "url",
  n: 1,
  steps: 4,
});

// now use `buildImagePrompt` to define a typesafe, specific image prompt:
const generateIconPrompt = buildImagePrompt(
  `
    {{request}}.
    Create a beautiful, flat color image suitable for iconography.
    Make it in the style of '{{style}}'.
  `,
  respondWithImage("url"),
);

// finally, use the `generateIconPrompt` function to request an image:
const images = await generateIconPrompt({
  request: "a red apple",
  style: "absurdism",
});
```

You can create your own `respondWithImage` function if you want to use a different inference
engine, or if you need special logging, tracking, retry logic, etc.

## Tests

`ts-prompt` comes with a test suite of unit tests and a handful of integration tests. The
integration tests need valid keys set as environment variables, to call out to an OpenAI API
endpoint (`OPENAI_API_KEY`), and the together.ai endpoint (`TOGETHER_API_KEY`). To run the tests,
use the following command:

```bash
# to run all tests:
$ deno task test

# or just unit tests:
$ deno task test:unit

# or just integration tests:
$ deno task test:integration
```
