import { assertEquals } from "jsr:@std/assert";
import { initPromptBuilder } from "./prompt.ts";
const { test } = Deno;

type ModelConfig = {
  provider: "openai";
  model: "gpt-3.5-turbo" | "gpt-4o";
};

type Request = {
  value: string;
};

const defaultConfig: ModelConfig = {
  provider: "openai",
  model: "gpt-3.5-turbo",
};

const mkPrompt = initPromptBuilder<ModelConfig, Request>(defaultConfig);

test("createPrompt without template args", async () => {
  const request = mkPrompt(`hello`, async () => null);
  const result = await request({ request: { value: "" } });
  assertEquals(result, null);
});

test("with template args", async () => {
  const request = mkPrompt(
    `hello {{world}}`,
    async ({ renderedTemplate }) => renderedTemplate,
  );
  const result = await request({
    templateArgs: { world: "earth" },
    request: { value: "" },
  });
  assertEquals(result, "hello earth");
});

test("with default prompt config", async () => {
  const request = mkPrompt(`hello`, async ({ config }) => config, {
    model: "gpt-4o",
  });
  const result = await request({ request: { value: "" } });
  assertEquals(result, {
    provider: "openai",
    model: "gpt-4o",
  });
});

test("with partial config", async () => {
  const request = mkPrompt(
    `hello`,
    async ({ config }) => `${config?.provider}/${config?.model}`,
  );
  const result = await request({
    request: { value: "" },
    config: { model: "gpt-4o" },
  });
  assertEquals(result, "openai/gpt-4o");
});

test("with request", async () => {
  const request = mkPrompt(
    `hello`,
    async ({ request, config }) => `${config?.model} with ${request?.value}`,
  );
  const result = await request({ request: { value: "context" } });
  assertEquals(result, "gpt-3.5-turbo with context");
});

test("returns typed result", async () => {
  type Result = { martians: number; earthlings: number };
  const request = mkPrompt(`hello`, async () => ({
    martians: 1,
    earthlings: 2,
  }));
  const result: Result = await request({ request: { value: "" } });
  assertEquals(result, { martians: 1, earthlings: 2 });
});
