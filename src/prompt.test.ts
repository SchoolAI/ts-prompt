import { assertEquals } from "jsr:@std/assert@1.0.8";
import { type InferenceParams, initPromptBuilder } from "./prompt.ts";
const { test } = Deno;

type ModelConfig = {
  provider: "openai";
  model: "gpt-3.5-turbo" | "gpt-4o";
};

type PromptContext = {
  value?: string;
} & ModelConfig;

const buildPrompt = initPromptBuilder<PromptContext>({
  provider: "openai",
  model: "gpt-3.5-turbo",
});

const mergeContext = (params: InferenceParams<PromptContext>) => {
  return {
    ...params.contextFromBuilder,
    ...params.contextFromPrompt,
    ...params.contextFromRequest,
  };
};

test("createPrompt without template args", async () => {
  const request = buildPrompt(`hello`, async () => null);
  const result = await request({});
  assertEquals(result, null);
});

test("with template args", async () => {
  const request = buildPrompt(
    `hello {{world}}`,
    async ({ renderedTemplate }) => renderedTemplate,
  );
  const result = await request({
    world: "earth",
  }, {
    value: "",
  });
  assertEquals(result, "hello earth");
});

test("with default prompt config", async () => {
  const request = buildPrompt(`hello`, async (params) => mergeContext(params), {
    model: "gpt-4o",
  });
  const result = await request({ value: "" });
  assertEquals(result, {
    value: "",
    provider: "openai",
    model: "gpt-4o",
  });
});

test("with partial config", async () => {
  const request = buildPrompt(
    `hello`,
    async (params) => {
      const context = mergeContext(params);
      return `${context.provider}/${context.model}`;
    },
  );
  const result = await request({
    model: "gpt-4o",
  });
  assertEquals(result, "openai/gpt-4o");
});

test("with request", async () => {
  const request = buildPrompt(
    `hello`,
    async (params) => {
      const context = mergeContext(params);
      return `${context.model} with ${context.value}`;
    },
  );
  const result = await request({ value: "context" });
  assertEquals(result, "gpt-3.5-turbo with context");
});

test("returns typed result", async () => {
  type Result = { martians: number; earthlings: number };
  const request = buildPrompt(`hello`, async () => ({
    martians: 1,
    earthlings: 2,
  }));
  const result: Result = await request({ value: "" });
  assertEquals(result, { martians: 1, earthlings: 2 });
});
