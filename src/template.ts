import { unindent } from "^/unindent.ts";

/**
 * A utility type that finds all curly-brace placeholders within a string and returns
 * them as a union type.
 *   e.g. "Give {{thing}} to {{person}}" returns the type ("thing" | "person")
 */
export type ExtractPlaceholders<S extends string> = S extends
  `${infer _Start}{{${infer Param}}}${infer Rest}`
  ? Param | ExtractPlaceholders<Rest>
  : never;

/**
 * A utility type that checks if a type is `never`
 */
export type IfNever<T, Y, N> = [T] extends [never] ? Y : N;

/**
 * A class that represents a template string with placeholders. Placeholders are denoted by
 * double curly-braces (e.g. `{{placeholder}}`).
 *
 * This class uses type refinement on the `string` type to offer type safety when rendering
 * a template with parameters.
 *
 * At runtime, you can access the list of placeholders in a template with the `placeholders`
 * property.
 */
export class Template<P extends string> {
  placeholders: IfNever<P, [], [string, ...string[]]>;

  // Private constructor to prevent instantiation outside of the `build` or `empty` methods
  private constructor(private template: string) {
    // Initialize the list of placeholders by finding all curly-brace placeholders in the template
    type PH = IfNever<P, [], [string, ...string[]]>;
    this.placeholders = [
      ...new Set(
        [...template.matchAll(/{{(\w+)}}/g)].map(([_match, p1]) => p1),
      ),
    ] as PH;
  }

  /**
   * Build a template from a static template literal
   */
  static build<S extends string>(
    template: S,
  ): Template<ExtractPlaceholders<S>> {
    return new Template(unindent(template));
  }

  /**
   * Build an empty template, with no placeholders.
   */
  static empty(): Template<""> {
    return new Template("");
  }

  /**
   * Render the template by inserting params wherever there are placeholders. The keys of `params`
   * must match placeholders exactly--there can be no incorrect or extra keys. If the Template has
   * no placeholders, than params must be undefined (i.e. not passed). This ensures that a Template
   * without placeholders will help identify error cases where a template's placeholders were
   * removed, but some `render` call points still pass (now non-existent) params.
   */
  render(params?: IfNever<P, undefined, { [key in P]: string }>): string {
    if (params === undefined) {
      return this.template;
    }

    return this.template.replace(/{{(\w+)}}/g, (_match, p1) => {
      if (p1 in params) {
        return params[p1 as P];
      }
      throw new Error(`Missing parameter: ${p1}`);
    });
  }

  /**
   * Return the original template string passed into the class at instantiation.
   */
  getTemplateString(): string {
    return this.template;
  }
}

/**
 * A utility function that combines multiple templates into a single template, unioning the
 * placeholders of each template.
 */
export function combineTemplates<SA extends readonly string[]>(
  ...templates: { [K in keyof SA]: Template<SA[K]> }
): Template<SA[number]> {
  const combinedTemplateString = templates
    .map((template) => template.getTemplateString())
    .join("\n");

  return Template.build<SA[number]>(combinedTemplateString);
}
