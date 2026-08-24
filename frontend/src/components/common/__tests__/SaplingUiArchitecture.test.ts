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

function collectVueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectVueFiles(path)
    return entry.isFile() && entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('Sapling UI architecture', () => {
  it('keeps raw Vuetify form controls behind Sapling components', () => {
    const violations: string[] = []
    const tags = Object.keys(rawControlOwners)
    const tagPattern = new RegExp(`<(${tags.join('|')})\\b`, 'g')

    for (const file of collectVueFiles(sourceRoot)) {
      const fileName = relative(sourceRoot, file).replaceAll('\\', '/')
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
      .map((file) => relative(sourceRoot, file).replaceAll('\\', '/'))

    expect(violations).toEqual([])
  })
})
