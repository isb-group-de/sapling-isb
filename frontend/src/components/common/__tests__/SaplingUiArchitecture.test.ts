import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const sourceRoot = join(process.cwd(), 'src')

const rawControlOwners: Record<string, string[]> = {
  'v-autocomplete': ['components/common/SaplingAutocomplete.vue'],
  'v-combobox': ['components/common/SaplingCombobox.vue'],
  'v-text-field': ['components/common/SaplingTextField.vue'],
  'v-textarea': ['components/common/SaplingTextarea.vue'],
  'v-switch': ['components/common/SaplingSwitch.vue'],
  'v-checkbox': [
    'components/common/SaplingCheckbox.vue',
    'components/table/cells/SaplingCellBoolean.vue',
    'components/table/SaplingTableDesktopView.vue',
    'components/table/SaplingTableRow.vue',
  ],
  'v-dialog': [
    'components/common/SaplingDialog.vue',
    // Songbird is a positioned floating overlay, not a standard card dialog.
    'components/system/SaplingAiChat.vue',
  ],
}

const contextualInlineErrorAlertOwners = [
  // JSON syntax feedback belongs to the field being edited.
  'components/dialog/fields/SaplingFieldJson.vue',
  // Tool-action failures are part of the persisted chat action itself.
  'components/system/ai-chat/SaplingAiChatToolActions.vue',
]

const tabularFieldPickerConsumers = [
  'components/dialog/fields/SaplingFieldCellDuplicateCheck.vue',
  'components/dialog/fields/SaplingFieldSelect.vue',
  'components/dialog/fields/SaplingFieldSingleSelect.vue',
]

const jsonDialogConsumers = [
  'components/dialog/fields/SaplingFieldJson.vue',
  'components/table/SaplingTableJson.vue',
]

function collectVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectVueFiles(path)
    return entry.isFile() && entry.name.endsWith('.vue') ? [path] : []
  })
}

function collectResponsiveStyleSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectResponsiveStyleSources(path)
    return entry.isFile() && (entry.name.endsWith('.css') || entry.name.endsWith('.vue'))
      ? [path]
      : []
  })
}

describe('Sapling UI architecture', () => {
  it('keeps raw Vuetify form controls behind Sapling components', () => {
    const violations: string[] = []
    const tags = Object.keys(rawControlOwners)
    const tagPattern = new RegExp(`<(${tags.join('|')})\\b`, 'g')

    for (const file of collectVueFiles(sourceRoot)) {
      const fileName = relative(sourceRoot, file).replace(/\\/g, '/')
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(tagPattern)) {
        const tag = match[1]
        if (!rawControlOwners[tag]?.includes(fileName)) {
          violations.push(`${fileName}: ${tag}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('does not reintroduce legacy dialog size classes', () => {
    const violations = collectVueFiles(sourceRoot)
      .filter((file) => /sapling-dialog-(small|medium|large)/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(sourceRoot, file).replace(/\\/g, '/'))

    expect(violations).toEqual([])
  })

  it('keeps every tabular field dropdown on the shared adaptive picker', () => {
    const violations = tabularFieldPickerConsumers.filter((fileName) => {
      const source = readFileSync(join(sourceRoot, fileName), 'utf8')
      return !/<SaplingFieldTablePicker\b/.test(source) || /<v-menu\b/.test(source)
    })

    expect(violations).toEqual([])
  })

  it('keeps JSON dialog titles and close actions in the shared dialog hero', () => {
    const violations = jsonDialogConsumers.filter((fileName) => {
      const source = readFileSync(join(sourceRoot, fileName), 'utf8')
      return !/<SaplingDialogHero\b/.test(source) || /<v-card-title\b/.test(source)
    })

    expect(violations).toEqual([])
  })

  it('routes general feedback through the message center', () => {
    const inlineErrorAlerts: string[] = []
    const snackbars: string[] = []

    for (const file of collectVueFiles(sourceRoot)) {
      const fileName = relative(sourceRoot, file).replace(/\\/g, '/')
      const source = readFileSync(file, 'utf8')

      if (/<v-snackbar\b/i.test(source)) {
        snackbars.push(fileName)
      }

      if (
        /<v-alert\b[\s\S]*?\btype=["']error["']/i.test(source) &&
        !contextualInlineErrorAlertOwners.includes(fileName)
      ) {
        inlineErrorAlerts.push(fileName)
      }
    }

    expect(snackbars).toEqual([])
    expect(inlineErrorAlerts).toEqual([])
  })

  it('keeps application typography independent from viewport width', () => {
    const viewportFontSize = /font-size\s*:\s*clamp\([^;]*(?:vw|vh|dvw|dvh)/
    const violations = collectResponsiveStyleSources(sourceRoot)
      .filter((file) => viewportFontSize.test(readFileSync(file, 'utf8')))
      .map((file) => relative(sourceRoot, file).replace(/\\/g, '/'))

    expect(violations).toEqual([])
  })
})
