import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaplingImportEntityCatalog } from '@/composables/import/useSaplingImportEntityCatalog'

const findEntities = vi.hoisted(() => vi.fn())
vi.mock('@/services/api.generic.service', () => ({
  default: { find: findEntities },
}))

describe('useSaplingImportEntityCatalog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('projects selected metadata and filters non-importable fields', () => {
    const entity = { handle: 'company', canRead: true }
    const permission = { entity: 'company', read: true }
    const genericStore = {
      getState: vi.fn(() => ({
        entity,
        entityPermission: permission,
        entityTemplates: [
          { name: 'handle', isPersistent: true },
          { name: 'name', isPersistent: true },
          { name: 'computed', isPersistent: false },
          { name: 'contacts', isPersistent: true, kind: '1:m' },
        ],
      })),
    }
    const currentPermissionStore = {
      accumulatedPermission: [permission],
    }

    const catalog = useSaplingImportEntityCatalog({
      selectedEntityHandle: ref('company'),
      selectedSourceHandle: ref('erp'),
      genericStore: genericStore as never,
      currentPermissionStore: currentPermissionStore as never,
      entityLabel: (handle) => handle.toUpperCase(),
    })

    expect(catalog.selectedEntity.value).toBe(entity)
    expect(catalog.selectedEntityPermission.value).toBe(permission)
    expect(catalog.currentPermissions.value).toEqual([permission])
    expect(catalog.importableFields.value.map((field) => field.name)).toEqual(['handle', 'name'])
    expect(catalog.openBatchFilter.value).toMatchObject({ executedAt: null })
    expect(catalog.entityFilter.value).toEqual({ canRead: { $ne: false } })
    expect(catalog.sourceFilter.value).toEqual({ isActive: true })
  })

  it('loads readable entities and exposes sorted selector options', async () => {
    findEntities.mockResolvedValue({
      data: [
        { handle: 'person', canRead: true },
        { handle: 'hidden', canRead: false },
        { handle: 'company', canRead: true },
      ],
    })
    const catalog = useSaplingImportEntityCatalog({
      selectedEntityHandle: ref(null),
      selectedSourceHandle: ref(null),
      genericStore: { getState: vi.fn() } as never,
      currentPermissionStore: { accumulatedPermission: [] } as never,
      entityLabel: (handle) => ({ company: 'Company', person: 'Person' })[handle] ?? handle,
    })

    await catalog.loadEntities()

    expect(catalog.entityOptions.value).toEqual([
      { title: 'Company', value: 'company' },
      { title: 'Person', value: 'person' },
    ])
  })
})
