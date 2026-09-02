import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import { canReadReferenceTemplate } from '@/utils/saplingTableUtil'

const PRELOAD_REFERENCE_KINDS = ['m:1', '1:1']
const REFERENCE_PRELOAD_DELAY_MS = 150

interface TableReferencePreloadOptions {
  templates: () => EntityTemplate[]
  permissions: () => AccumulatedPermission[]
  ensurePermissions: () => Promise<unknown>
  loadReferences: (referenceNames: string[]) => Promise<unknown>
}

export function useSaplingTableReferencePreload(options: TableReferencePreloadOptions) {
  let timeout: ReturnType<typeof setTimeout> | null = null

  function cancel() {
    if (!timeout) return
    clearTimeout(timeout)
    timeout = null
  }

  async function preload() {
    await options.ensurePermissions()
    const referenceNames = Array.from(
      new Set(
        options
          .templates()
          .filter(
            (template) =>
              PRELOAD_REFERENCE_KINDS.includes(template.kind ?? '') &&
              template.referenceName &&
              canReadReferenceTemplate(template, options.permissions()),
          )
          .map((template) => template.referenceName as string),
      ),
    )
    if (referenceNames.length) await options.loadReferences(referenceNames)
  }

  function schedule() {
    cancel()
    timeout = setTimeout(() => {
      timeout = null
      void preload()
    }, REFERENCE_PRELOAD_DELAY_MS)
  }

  return { cancel, schedule }
}
