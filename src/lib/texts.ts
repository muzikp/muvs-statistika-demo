import cs from '../locales/cs.json';

export const dictionary = cs;
type TextPaths<T> = { [K in keyof T & string]: T[K] extends string ? K : T[K] extends readonly unknown[] ? never : T[K] extends object ? `${K}.${TextPaths<T[K]>}` : never }[keyof T & string];
export type TextKey = TextPaths<typeof cs>;
export type TextParameters = Record<string, string | number | boolean | null | undefined>;

export function formatText(template: string, parameters: TextParameters = {}): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, key: string) => Object.hasOwn(parameters, key) ? String(parameters[key] ?? '') : token);
}

export function t(key: TextKey, parameters: TextParameters = {}): string {
  let value: unknown = cs;
  for (const part of key.split('.')) value = (value as Record<string, unknown>)[part];
  if (typeof value !== 'string') throw new Error(`Missing text: ${key}`);
  return formatText(value, parameters);
}
