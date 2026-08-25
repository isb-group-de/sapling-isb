import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'

export type FieldPermissionActionKey = 'allowRead' | 'allowInsert' | 'allowUpdate'

export interface FieldPermissionCatalogField {
  name: string
  type: string
  formGroup?: string | null
  options: string[]
  isHandle: boolean
  isRequired: boolean
  isReference: boolean
  customField?: Record<string, unknown> | null
  structural: Record<FieldPermissionActionKey, boolean>
  inherited: Record<FieldPermissionActionKey, boolean>
  override: Record<FieldPermissionActionKey, boolean> | null
  effective: Record<FieldPermissionActionKey, boolean> & {
    allowReadStage?: string
    allowInsertStage?: string
    allowUpdateStage?: string
  }
}

export interface FieldPermissionCatalog {
  roleHandle: number
  entityHandle: string
  entityPermission: Record<FieldPermissionActionKey, boolean>
  staleOverrides: FieldPermissionOverride[]
  fields: FieldPermissionCatalogField[]
}

export interface FieldPermissionOverride {
  fieldName: string
  allowRead: boolean
  allowInsert: boolean
  allowUpdate: boolean
}

export default class ApiFieldPermissionService {
  static async getCatalog(roleHandle: number, entityHandle: string) {
    const response = await axios.get<FieldPermissionCatalog>(
      buildApiUrl(`permission-admin/roles/${roleHandle}/entities/${entityHandle}/fields`),
    )
    return response.data
  }

  static async saveOverrides(
    roleHandle: number,
    entityHandle: string,
    fields: FieldPermissionOverride[],
  ) {
    const response = await axios.put<FieldPermissionCatalog>(
      buildApiUrl(`permission-admin/roles/${roleHandle}/entities/${entityHandle}/fields`),
      { fields },
    )
    return response.data
  }
}
