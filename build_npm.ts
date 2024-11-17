import { build } from 'https://deno.land/x/dnt@0.7.4/mod.ts'

await build({
  entryPoints: ['./src/mod.ts'],
  outDir: './npm',
  package: {
    name: 'ts-prompt',
    version: Deno.args[0]?.replace(/^v/, ''),
    description:
      'Typesafe prompt construction for LLM inference with zod-parsed results',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/SchoolAI/ts-prompt.git',
    },
    bugs: {
      url: 'https://github.com/SchoolAI/ts-prompt.git',
    },
    peerDependencies: {
      "openai": "^4.55.5",
      "zod": "^3.0.0"
    }
  },
})
