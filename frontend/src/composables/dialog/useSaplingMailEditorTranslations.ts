type Translate = (key: string, params?: Record<string, unknown>) => string

export function useSaplingMailEditorTranslations(options: {
  t: Translate
  te: (key: string) => boolean
}) {
  function translate(key: string): string {
    return options.t(key)
  }

  function translateIfExists(key: string, fallback: string): string {
    return options.te(key) ? options.t(key) : fallback
  }

  function translateWithParams(key: string, params: Record<string, unknown>): string {
    return options.te(key) ? options.t(key, params) : key
  }

  function translateTemplateLabel(entityHandle: string, property: string): string {
    return entityHandle ? translateIfExists(`${entityHandle}.${property}`, property) : property
  }

  return { translate, translateIfExists, translateTemplateLabel, translateWithParams }
}
