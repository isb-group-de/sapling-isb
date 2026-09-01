export interface MarkdownRule {
  (value: string | null): boolean | string
}

export interface MarkdownTransformResult {
  text: string
  selectionStart?: number
  selectionEnd?: number
}

export interface MarkdownEditorHandle {
  applySelection(transform: (selectedText: string) => MarkdownTransformResult): string | null
  focus(): void
}

export type MarkdownToolbarGroupKey = 'structure' | 'text' | 'lists' | 'media' | 'code'

export interface MarkdownToolbarAction {
  key: string
  group: MarkdownToolbarGroupKey
  icon: string
  title: string
  run: () => void
}
