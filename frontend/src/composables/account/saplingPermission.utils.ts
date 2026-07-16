import type {
  EntityItem,
  PermissionItem,
  PersonItem,
  RoleItem,
  RoleStageItem,
} from '../../entity/entity'

export type PermissionType =
  | 'allowInsert'
  | 'allowRead'
  | 'allowUpdate'
  | 'allowDelete'
  | 'allowShow'
export type PermissionFilterMode = 'all' | 'enabled' | 'disabled'
export type PermissionSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type PermissionStateSnapshot = Record<PermissionType, boolean>

export const PERMISSION_FIELDS: PermissionType[] = [
  'allowShow',
  'allowRead',
  'allowInsert',
  'allowUpdate',
  'allowDelete',
]

export function getEntityGroupHandle(entity: EntityItem): string | null {
  if (typeof entity.group === 'string') {
    return entity.group || null
  }

  if (entity.group && typeof entity.group === 'object' && typeof entity.group.handle === 'string') {
    return entity.group.handle
  }

  return null
}

export function getPermissionTypesForEntity(entity: EntityItem): PermissionType[] {
  return PERMISSION_FIELDS.filter((permissionType) => {
    switch (permissionType) {
      case 'allowShow':
        return entity.canShow === true
      case 'allowRead':
        return entity.canRead === true
      case 'allowInsert':
        return entity.canInsert === true
      case 'allowUpdate':
        return entity.canUpdate === true
      case 'allowDelete':
        return entity.canDelete === true
    }
  })
}

export function getPermission(role: RoleItem, item: EntityItem, type: PermissionType): boolean {
  return getPermissionState(getPermissionRecord(role, item.handle))[type]
}

export const getStageTitle = (stage: RoleStageItem | string): string => {
  if (!stage) return 'global'
  if (typeof stage === 'string') return stage
  if (typeof stage === 'object' && 'title' in stage) return stage.title
  return 'global'
}

export function getRoleMemberCount(role: RoleItem): number {
  return role.persons?.length || 0
}

export function getEnabledPermissionCount(role: RoleItem): number {
  return (role.permissions || []).reduce(
    (total, permission) =>
      total + PERMISSION_FIELDS.filter((field) => permission[field] === true).length,
    0,
  )
}

export function hasAnyEnabledPermission(role: RoleItem, entity: EntityItem): boolean {
  const permissionState = getPermissionState(getPermissionRecord(role, entity.handle))
  return PERMISSION_FIELDS.some((field) => permissionState[field])
}

export function assignPermissionResponse(
  role: RoleItem,
  entityHandle: string,
  permission: PermissionItem,
) {
  const existingPermission = getPermissionRecord(role, entityHandle)
  if (existingPermission) {
    Object.assign(existingPermission, clonePermission(permission))
    return
  }

  if (!role.permissions) {
    role.permissions = []
  }

  role.permissions.push(clonePermission(permission))
}

export function ensurePermissionRecord(role: RoleItem, entity: EntityItem): PermissionItem {
  const existingPermission = getPermissionRecord(role, entity.handle)
  if (existingPermission) {
    return existingPermission
  }

  const createdPermission: PermissionItem = {
    entity: entity.handle,
    roles: role.handle != null ? [role.handle] : [],
    allowRead: false,
    allowInsert: false,
    allowUpdate: false,
    allowDelete: false,
    allowShow: false,
    createdAt: new Date(),
  }

  if (!role.permissions) {
    role.permissions = []
  }

  role.permissions.push(createdPermission)
  return createdPermission
}

export function getPermissionRecord(
  role: RoleItem,
  entityHandle: string,
): PermissionItem | undefined {
  return role.permissions?.find(
    (permission) => getPermissionEntityHandle(permission) === entityHandle,
  )
}

export function getPermissionEntityHandle(permission: PermissionItem): string {
  return typeof permission.entity === 'object'
    ? permission.entity.handle
    : String(permission.entity)
}

export function getPermissionRecordHandle(permission?: PermissionItem): number | string | null {
  if (!permission || typeof permission !== 'object') {
    return null
  }

  return 'handle' in permission
    ? ((permission.handle as number | string | null | undefined) ?? null)
    : null
}

export function getPermissionState(permission?: PermissionItem): PermissionStateSnapshot {
  return {
    allowShow: permission?.allowShow === true,
    allowRead: permission?.allowRead === true,
    allowInsert: permission?.allowInsert === true,
    allowUpdate: permission?.allowUpdate === true,
    allowDelete: permission?.allowDelete === true,
  }
}

export function isPermissionRecordEnabled(permission: PermissionItem): boolean {
  return isPermissionStateEnabled(getPermissionState(permission))
}

export function isPermissionStateEnabled(permissionState: PermissionStateSnapshot): boolean {
  return PERMISSION_FIELDS.some((field) => permissionState[field])
}

export function getPermissionMutationKey(roleHandle: number | null, entityHandle: string): string {
  return `${String(roleHandle)}:${entityHandle}`
}

export function getRoleByHandle(
  roleList: RoleItem[],
  roleHandle: number | null,
): RoleItem | undefined {
  return roleList.find((role) => role.handle === roleHandle)
}

export function cloneRoles(roleList: RoleItem[]): RoleItem[] {
  return roleList.map(cloneRole)
}

export function cloneRole(role: RoleItem): RoleItem {
  return {
    ...role,
    persons: (role.persons || []).map(clonePerson),
    permissions: (role.permissions || []).map(clonePermission),
  }
}

export function clonePerson(person: PersonItem): PersonItem {
  return {
    ...person,
    roles: [...(person.roles || [])],
  }
}

export function clonePermission(permission: PermissionItem): PermissionItem {
  return {
    ...permission,
    roles: [...(permission.roles || [])],
    entity: typeof permission.entity === 'object' ? { ...permission.entity } : permission.entity,
  }
}

export function updateRoleMembership(
  role: RoleItem,
  targetRoleHandle: number | null,
  person: PersonItem,
  shouldAdd: boolean,
): RoleItem {
  if (role.handle !== targetRoleHandle) {
    return role
  }

  const personsForRole = [...(role.persons || [])]

  if (shouldAdd) {
    if (!personsForRole.some((entry) => entry.handle === person.handle)) {
      personsForRole.push(clonePerson(person))
    }

    return {
      ...role,
      persons: personsForRole,
    }
  }

  return {
    ...role,
    persons: personsForRole.filter((entry) => entry.handle !== person.handle),
  }
}
