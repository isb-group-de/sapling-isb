import { describe, expect, it } from 'vitest'
import type { EntityTemplate, SaplingFormConfigPayload } from '@/entity/structure'
import { applyFormConfigOverlay } from '../saplingDialogEdit.utils'

describe('saplingDialogEdit utils', () => {
  it('applies central group metadata without repeating it on every field', () => {
    const templates = [
      {
        key: 'title',
        name: 'title',
        type: 'string',
        formGroup: 'basics',
        formGroupOrder: 200,
        formVisible: true,
      },
    ] satisfies EntityTemplate[]
    const config = {
      schema: 'sapling.form-config.v1',
      entityHandle: 'ticket',
      groups: {
        basics: {
          visible: false,
          order: 100,
          label: 'Main data',
        },
      },
    } satisfies SaplingFormConfigPayload

    expect(applyFormConfigOverlay(templates, config)[0]).toMatchObject({
      formGroup: 'basics',
      formGroupOrder: 100,
      formVisible: false,
      formGroupConfig: {
        visible: false,
        order: 100,
        label: 'Main data',
      },
    })
  })

  it('uses the configured field group before resolving its group overlay', () => {
    const templates = [
      {
        key: 'title',
        name: 'title',
        type: 'string',
        formGroup: 'basics',
        formVisible: true,
      },
    ] satisfies EntityTemplate[]
    const config = {
      schema: 'sapling.form-config.v1',
      entityHandle: 'ticket',
      fields: { title: { group: 'details' } },
      groups: { details: { visible: false } },
    } satisfies SaplingFormConfigPayload

    expect(applyFormConfigOverlay(templates, config)[0]).toMatchObject({
      formGroup: 'details',
      formVisible: false,
    })
  })
})
