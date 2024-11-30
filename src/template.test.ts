import { assertEquals } from "jsr:@std/assert@1.0.8";
import { combineTemplates, Template } from "^/template.ts";
const { test } = Deno;

test("Render a Template without placeholders", () => {
  const tpl = Template.build("Hello there!");

  assertEquals(tpl.render(), "Hello there!");
  assertEquals(tpl.placeholders, []);
});

test("Render a Template with one unique placeholder", () => {
  const tpl = Template.build("Hello {{greet}}!");

  assertEquals(tpl.render({ greet: "World" }), "Hello World!");
  assertEquals(tpl.placeholders, ["greet"]);
});

test("Render a Template with two unique placeholders", () => {
  const tpl = Template.build("Hello {{greet}}! My name is {{name}}.");

  assertEquals(
    tpl.render({ greet: "World", name: "Rosie" }),
    "Hello World! My name is Rosie.",
  );
  assertEquals(tpl.placeholders, ["greet", "name"]);
});

test("Render a Template with one placeholder used several times", () => {
  const tpl = Template.build(
    "Hello {{greet}}! Wait, are you really {{greet}}?",
  );

  assertEquals(
    tpl.render({ greet: "World" }),
    "Hello World! Wait, are you really World?",
  );
  assertEquals(tpl.placeholders, ["greet"]);
});

test(
  "Render a Template with one placeholder used correctly once and once without closing delimiter",
  () => {
    const tpl = Template.build(
      "Hello {{greet}}! Wait, are you really {{greet?",
    );

    assertEquals(
      tpl.render({ greet: "World" }),
      "Hello World! Wait, are you really {{greet?",
    );
  },
);

test("Template is rendered with resulting string unindented", () => {
  const tpl = Template.build(`
    Hello {{greet}}!
    Wait, are you really {{greet}}?
  `);

  assertEquals(
    tpl.render({ greet: "World" }),
    "Hello World!\nWait, are you really World?\n",
  );
});

test(
  "Template can be concatenated with another Template and types are preserved",
  () => {
    const t1 = Template.build("hello {{name}}");
    const t2 = Template.build("{{fruit}} flavor");
    const tpl = combineTemplates(t1, t2);

    assertEquals(
      tpl.render({ name: "Rosie", fruit: "apple" }),
      "hello Rosie\napple flavor",
    );
  },
);

test("Several Templates can be combined", () => {
  const t1 = Template.build("hello {{name}}");
  const t2 = Template.build("{{fruit}} flavor");
  const t3 = Template.build("good {{occasion}}");

  const tpl = combineTemplates(t1, t2, t3);

  assertEquals(
    tpl.render({ name: "Rosie", fruit: "apple", occasion: "day" }),
    "hello Rosie\napple flavor\ngood day",
  );
});
