export interface MarkdownRule {
  (value: string | null): boolean | string
}

export interface MarkdownTransformResult {
  text: string
  selectionStart?: number
  selectionEnd?: number
}

export interface MarkdownTextSelection {
  from: number
  to: number
}

export interface MarkdownSelectionCoordinates {
  left: number
  top: number
  bottom: number
}

export interface MarkdownSelectionState extends MarkdownTextSelection {
  value: string
  focused: boolean
  coordinates: MarkdownSelectionCoordinates | null
}

export interface MarkdownEditorHandle {
  applySelection(transform: (selectedText: string) => MarkdownTransformResult): string | null
  focus(): void
  getSelection(): MarkdownTextSelection | null
  replaceRange(from: number, to: number, text: string): string | null
}

export type MarkdownToolbarGroupKey = 'structure' | 'text' | 'lists' | 'media' | 'code'

export interface MarkdownToolbarAction {
  key: string
  group: MarkdownToolbarGroupKey
  icon: string
  title: string
  run: () => void
}
