import { build, type BuildOptions } from "jsr:@deno/dnt@0.41.3";

const packageOptions: BuildOptions["package"] = {
  name: "ts-prompt",
  version: Deno.args[0]?.replace(/^v/, ""),
  description:
    "Typesafe prompt construction for LLM inference with zod-parsed results",
  license: "MIT",
  repository: {
    type: "git",
    url: "git+https://github.com/SchoolAI/ts-prompt.git",
  },
  peerDependencies: {
    "zod": "^3.0.0",
    "zod-to-json-schema": "^3.23.0",
  },
};

const options: BuildOptions = {
  entryPoints: ["mod.ts", {
    name: "./openai",
    path: "./openai.ts",
  }],
  outDir: "./npm",
  shims: { deno: true },
  package: packageOptions,
  compilerOptions: {
    lib: ["ESNext"],
  },
  testPattern: "./src/*.test.ts",
};

await build(options);
