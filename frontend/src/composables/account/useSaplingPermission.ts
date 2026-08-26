import { computed, onMounted, reactive, ref, watch } from 'vue'
import ApiGenericService from '../../services/api.generic.service'
import type { EntityItem, PermissionItem, PersonItem, RoleItem } from '../../entity/entity'
import { i18n } from '@/i18n'
import { useGenericStore } from '@/stores/genericStore'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  PERMISSION_FIELDS,
  assignPermissionResponse,
  clonePerson,
  cloneRoles,
  ensurePermissionRecord,
  getEnabledPermissionCount,
  getEntityGroupHandle,
  getPermissionEntityHandle,
  getPermission,
  getPermissionMutationKey,
  getPermissionRecord,
  getPermissionRecordHandle,
  getPermissionState,
  getPermissionTypesForEntity,
  getRoleByHandle,
  getRoleMemberCount,
  getStageTitle,
  hasAnyEnabledPermission,
  isPermissionRecordEnabled,
  isPermissionStateEnabled,
  updateRoleMembership,
  type PermissionFilterMode,
  type PermissionSaveState,
  type PermissionType,
} from './saplingPermission.utils'

/**
 * Provides dashboard-oriented state and actions for the permission management screen.
 */
export function useSaplingPermission() {
  //#region State
  const genericStore = useGenericStore()
  const messageCenter = useSaplingMessageCenter()

  genericStore.loadGeneric(
    'permission',
    'global',
    'entity',
    'role',
    'roleStage',
    'right',
    'person',
    'providerUserImport',
    'navigationGroup',
  )

  const permissionEntity = computed(() => genericStore.getState('permission').entity)

  const persons = ref<PersonItem[]>([])
  const roles = ref<RoleItem[]>([])
  const entities = ref<EntityItem[]>([])
  const originalRoles = ref<RoleItem[]>([])

  const roleSearch = ref('')
  const permissionSearch = ref('')
  const permissionFilterMode = ref<PermissionFilterMode>('all')
  const selectedRoleHandle = ref<number | null>(null)
  const selectedGroup = ref<string | null>(null)

  const isBootstrapping = ref(true)
  const membersArePending = ref(false)
  const permissionSaveState = ref<PermissionSaveState>('idle')

  const pendingPermissionKeys = reactive<Record<string, boolean>>({})

  const deleteDialog = reactive<{
    visible: boolean
    person: PersonItem | null
    role: RoleItem | null
  }>({
    visible: false,
    person: null,
    role: null,
  })

  const permissionIsLoading = computed(
    () => genericStore.getState('permission').isLoading || isBootstrapping.value,
  )

  const permissionGroups = computed<string[]>(() => {
    const groupHandles = entities.value
      .map(getEntityGroupHandle)
      .filter((groupHandle): groupHandle is string => Boolean(groupHandle))

    return Array.from(new Set(groupHandles))
  })

  const filteredRoles = computed<RoleItem[]>(() => {
    const query = roleSearch.value.trim().toLowerCase()
    if (!query) {
      return roles.value
    }

    return roles.value.filter((role) => {
      const haystack = [
        role.title,
        getStageTitle(role.stage),
        ...(role.persons || []).map((person) => `${person.firstName} ${person.lastName}`),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  })

  const selectedRole = computed<RoleItem | null>(() => {
    if (selectedRoleHandle.value == null) {
      return roles.value[0] || null
    }

    return roles.value.find((role) => role.handle === selectedRoleHandle.value) || null
  })

  const selectedRoleMembers = computed<PersonItem[]>(() => selectedRole.value?.persons || [])

  const availablePersonsForSelectedRole = computed<PersonItem[]>(() => {
    if (!selectedRole.value) {
      return []
    }

    const roleHandle = String(selectedRole.value.handle)
    return persons.value
      .filter(
        (person) =>
          !(person.roles || []).some(
            (role) => String(typeof role === 'object' ? role.handle : role) === roleHandle,
          ),
      )
      .map((person) => ({
        ...person,
        fullName: `${person.firstName} ${person.lastName}`,
      }))
  })

  const filteredGroupEntities = computed<EntityItem[]>(() => {
    if (!selectedRole.value || !selectedGroup.value) {
      return []
    }

    const role = selectedRole.value
    const query = permissionSearch.value.trim().toLowerCase()

    return entities.value.filter((entity) => {
      if (getEntityGroupHandle(entity) !== selectedGroup.value) {
        return false
      }

      if (query) {
        const entityLabel = String(entity.handle).toLowerCase()
        if (!entityLabel.includes(query)) {
          return false
        }
      }

      if (permissionFilterMode.value === 'enabled') {
        return hasAnyEnabledPermission(role, entity)
      }

      if (permissionFilterMode.value === 'disabled') {
        return !hasAnyEnabledPermission(role, entity)
      }

      return true
    })
  })

  const dashboardStats = computed(() => ({
    roleCount: roles.value.length,
    memberCount: persons.value.length,
    groupCount: permissionGroups.value.length,
    enabledPermissionCount: roles.value.reduce(
      (total, role) => total + getEnabledPermissionCount(role),
      0,
    ),
  }))

  const selectedRoleStats = computed(() => {
    if (!selectedRole.value) {
      return {
        memberCount: 0,
        enabledPermissionCount: 0,
        dirtyEntityCount: 0,
      }
    }

    return {
      memberCount: selectedRoleMembers.value.length,
      enabledPermissionCount: getEnabledPermissionCount(selectedRole.value),
      dirtyEntityCount: getDirtyEntityCount(selectedRole.value),
    }
  })

  const hasUnsavedPermissionChanges = computed(() => roles.value.some((role) => isRoleDirty(role)))
  //#endregion

  //#region Lifecycle
  watch(
    filteredRoles,
    (nextRoles) => {
      if (!nextRoles.length) {
        selectedRoleHandle.value = null
        return
      }

      if (
        selectedRoleHandle.value == null ||
        !nextRoles.some((role) => role.handle === selectedRoleHandle.value)
      ) {
        selectedRoleHandle.value = nextRoles[0].handle ?? null
      }
    },
    { immediate: true },
  )

  watch(
    permissionGroups,
    (groups) => {
      if (!groups.length) {
        selectedGroup.value = null
        return
      }

      if (!selectedGroup.value || !groups.includes(selectedGroup.value)) {
        selectedGroup.value = groups[0]
      }
    },
    { immediate: true },
  )

  watch(hasUnsavedPermissionChanges, (hasChanges) => {
    if (!hasChanges && permissionSaveState.value === 'dirty') {
      permissionSaveState.value = 'idle'
    }

    if (
      hasChanges &&
      (permissionSaveState.value === 'saved' || permissionSaveState.value === 'error')
    ) {
      permissionSaveState.value = 'dirty'
    }
  })

  onMounted(async () => {
    isBootstrapping.value = true

    try {
      await Promise.all([refreshPersons(), refreshRoles(), refreshEntities()])
    } finally {
      isBootstrapping.value = false
    }
  })
  //#endregion

  //#region Methods
  async function refreshPersons() {
    const response = await ApiGenericService.findAll<PersonItem>('person', {
      relations: ['roles'],
    })
    persons.value = response.map(clonePerson)
  }

  async function refreshRoles() {
    const response = await ApiGenericService.findAll<RoleItem>('role', {
      relations: ['m:1', 'permissions', 'permissions.fieldPermissions', 'persons'],
    })
    roles.value = cloneRoles(response)
    originalRoles.value = cloneRoles(response)
  }

  async function refreshEntities() {
    const response = await ApiGenericService.findAll<EntityItem>('entity', {
      relations: ['group'],
    })
    entities.value = response.map((entity) => ({ ...entity }))
  }

  async function refreshPermissionMembers() {
    membersArePending.value = true
    try {
      await Promise.all([refreshPersons(), refreshRoles()])
    } finally {
      membersArePending.value = false
    }
  }

  function selectRole(roleHandle: number | null) {
    selectedRoleHandle.value = roleHandle
  }

  function setSelectedGroup(group: string | null) {
    selectedGroup.value = group
  }

  function setPermission(role: RoleItem, item: EntityItem, type: PermissionType, value: boolean) {
    const permission = ensurePermissionRecord(role, item)
    permission[type] = value

    const baselinePermission = getBaselinePermission(role.handle, item.handle)
    if (!baselinePermission && !isPermissionRecordEnabled(permission)) {
      role.permissions = (role.permissions || []).filter(
        (entry) => getPermissionEntityHandle(entry) !== item.handle,
      )
    }

    permissionSaveState.value = hasUnsavedPermissionChanges.value ? 'dirty' : 'idle'
  }

  function setAllPermissionsForEntity(role: RoleItem, item: EntityItem, value: boolean) {
    for (const permissionType of getPermissionTypesForEntity(item)) {
      setPermission(role, item, permissionType, value)
    }
  }

  async function savePermissionChanges() {
    if (!hasUnsavedPermissionChanges.value || permissionSaveState.value === 'saving') {
      return
    }

    permissionSaveState.value = 'saving'

    try {
      for (const role of roles.value) {
        if (role.handle == null || !isRoleDirty(role)) {
          continue
        }

        await persistRolePermissions(role)
      }

      originalRoles.value = cloneRoles(roles.value)
      permissionSaveState.value = 'saved'
      messageCenter.pushMessage('success', i18n.global.t('permission.saved'), '', 'permission')
    } catch (error: unknown) {
      permissionSaveState.value = 'error'
      throw error
    }
  }

  function resetPermissionChanges() {
    roles.value = cloneRoles(originalRoles.value)
    permissionSearch.value = ''
    permissionFilterMode.value = 'all'
    permissionSaveState.value = 'idle'
  }

  async function handleAddSelectedPersonsToRole(selectedPersons: PersonItem[]) {
    const role = selectedRole.value
    if (!role || role.handle == null || !selectedPersons.length) {
      return
    }

    membersArePending.value = true

    try {
      for (const person of selectedPersons) {
        if (person.handle == null) {
          continue
        }

        await ApiGenericService.createReference<PersonItem>(
          'person',
          'roles',
          person.handle,
          role.handle,
        )
        applyMembershipChange(person, role, true)
      }
    } finally {
      membersArePending.value = false
    }
  }

  function openDeleteDialog(person: PersonItem, role: RoleItem) {
    deleteDialog.visible = true
    deleteDialog.person = person
    deleteDialog.role = role
  }

  function updateDeleteDialogVisibility(value: boolean) {
    deleteDialog.visible = value
  }

  function cancelRemovePersonFromRole() {
    deleteDialog.visible = false
    deleteDialog.person = null
    deleteDialog.role = null
  }

  async function confirmRemovePersonFromRole() {
    if (
      !deleteDialog.person ||
      !deleteDialog.role ||
      deleteDialog.person.handle == null ||
      deleteDialog.role.handle == null
    ) {
      cancelRemovePersonFromRole()
      return
    }

    membersArePending.value = true

    try {
      await ApiGenericService.deleteReference<PersonItem>(
        'person',
        'roles',
        deleteDialog.person.handle,
        deleteDialog.role.handle,
      )
      applyMembershipChange(deleteDialog.person, deleteDialog.role, false)
      cancelRemovePersonFromRole()
    } finally {
      membersArePending.value = false
    }
  }

  function isRoleDirty(role: RoleItem): boolean {
    return entities.value.some((entity) => isPermissionDirty(role, entity))
  }

  function isPermissionDirty(role: RoleItem, entity: EntityItem): boolean {
    const currentState = getPermissionState(getPermissionRecord(role, entity.handle))
    const baselineState = getPermissionState(getBaselinePermission(role.handle, entity.handle))

    return PERMISSION_FIELDS.some((field) => currentState[field] !== baselineState[field])
  }

  function isPermissionPending(role: RoleItem, entity: EntityItem): boolean {
    return Boolean(pendingPermissionKeys[getPermissionMutationKey(role.handle, entity.handle)])
  }

  function getDirtyEntityCount(role: RoleItem): number {
    return entities.value.filter((entity) => isPermissionDirty(role, entity)).length
  }

  function applyMembershipChange(person: PersonItem, role: RoleItem, shouldAdd: boolean) {
    roles.value = roles.value.map((entry) =>
      updateRoleMembership(entry, role.handle, person, shouldAdd),
    )
    originalRoles.value = originalRoles.value.map((entry) =>
      updateRoleMembership(entry, role.handle, person, shouldAdd),
    )

    persons.value = persons.value.map((entry) => {
      if (entry.handle !== person.handle) {
        return entry
      }

      const nextRoles = [...(entry.roles || [])]
      const nextRoleReference = { handle: role.handle, title: role.title } as RoleItem

      if (shouldAdd) {
        if (
          !nextRoles.some(
            (roleEntry) =>
              String(typeof roleEntry === 'object' ? roleEntry.handle : roleEntry) ===
              String(role.handle),
          )
        ) {
          nextRoles.push(nextRoleReference)
        }

        return {
          ...entry,
          roles: nextRoles,
        }
      }

      return {
        ...entry,
        roles: nextRoles.filter(
          (roleEntry) =>
            String(typeof roleEntry === 'object' ? roleEntry.handle : roleEntry) !==
            String(role.handle),
        ),
      }
    })
  }

  async function persistRolePermissions(role: RoleItem) {
    const originalRole = getRoleByHandle(originalRoles.value, role.handle)

    for (const entity of entities.value) {
      if (!isPermissionDirty(role, entity)) {
        continue
      }

      const permissionKey = getPermissionMutationKey(role.handle, entity.handle)
      pendingPermissionKeys[permissionKey] = true

      try {
        const currentPermission = getPermissionRecord(role, entity.handle)
        const baselinePermission = originalRole
          ? getPermissionRecord(originalRole, entity.handle)
          : undefined
        const permissionState = getPermissionState(currentPermission)

        if (!baselinePermission) {
          if (!isPermissionStateEnabled(permissionState)) {
            continue
          }

          const createdPermission = await ApiGenericService.create<PermissionItem>('permission', {
            entity: entity.handle,
            roles: role.handle != null ? [role.handle] : [],
            createdAt: new Date(),
            ...permissionState,
          })

          assignPermissionResponse(role, entity.handle, createdPermission)
          continue
        }

        const permissionHandle =
          getPermissionRecordHandle(currentPermission) ??
          getPermissionRecordHandle(baselinePermission)
        if (permissionHandle == null) {
          continue
        }

        const updatedPermission = await ApiGenericService.update<PermissionItem>(
          'permission',
          permissionHandle,
          permissionState,
        )
        assignPermissionResponse(role, entity.handle, updatedPermission)
      } finally {
        pendingPermissionKeys[permissionKey] = false
      }
    }
  }

  function getBaselinePermission(
    roleHandle: number | null,
    entityHandle: string,
  ): PermissionItem | undefined {
    const baselineRole = getRoleByHandle(originalRoles.value, roleHandle)
    return baselineRole ? getPermissionRecord(baselineRole, entityHandle) : undefined
  }

  //#endregion

  //#region Return
  return {
    roles,
    roleSearch,
    filteredRoles,
    selectedRole,
    selectedRoleHandle,
    selectedGroup,
    permissionGroups,
    permissionSearch,
    permissionFilterMode,
    filteredGroupEntities,
    selectedRoleMembers,
    availablePersonsForSelectedRole,
    dashboardStats,
    selectedRoleStats,
    permissionEntity,
    permissionIsLoading,
    membersArePending,
    deleteDialog,
    permissionSaveState,
    hasUnsavedPermissionChanges,
    selectRole,
    setSelectedGroup,
    setPermission,
    setAllPermissionsForEntity,
    savePermissionChanges,
    resetPermissionChanges,
    handleAddSelectedPersonsToRole,
    refreshPermissionMembers,
    openDeleteDialog,
    updateDeleteDialogVisibility,
    cancelRemovePersonFromRole,
    confirmRemovePersonFromRole,
    getStageTitle,
    getPermission,
    isRoleDirty,
    isPermissionDirty,
    isPermissionPending,
    getRoleMemberCount,
    getEnabledPermissionCount,
  }
  //#endregion
}
