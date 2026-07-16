import { describe, expect, it } from 'vitest'
import type { EntityItem, PersonItem, RoleItem } from '../../entity/entity'
import {
  cloneRoles,
  getPermissionTypesForEntity,
  getPermissionState,
  updateRoleMembership,
} from './saplingPermission.utils'

describe('saplingPermission utils', () => {
  it('projects only capabilities supported by an entity', () => {
    const entity = {
      handle: 'ticket',
      canShow: true,
      canRead: true,
      canInsert: false,
      canUpdate: true,
      canDelete: false,
    } as EntityItem

    expect(getPermissionTypesForEntity(entity)).toEqual(['allowShow', 'allowRead', 'allowUpdate'])
  })

  it('clones nested role permission and member state', () => {
    const roles = [
      {
        handle: 1,
        persons: [{ handle: 2, roles: [] }],
        permissions: [{ entity: { handle: 'ticket' }, roles: [1], allowRead: true }],
      },
    ] as unknown as RoleItem[]

    const cloned = cloneRoles(roles)
    cloned[0].persons![0].roles!.push({ handle: 3 } as RoleItem)
    cloned[0].permissions![0].allowRead = false

    expect(roles[0].persons![0].roles).toEqual([])
    expect(getPermissionState(roles[0].permissions![0]).allowRead).toBe(true)
  })

  it('adds and removes a member without mutating unrelated roles', () => {
    const person = { handle: 7, roles: [] } as unknown as PersonItem
    const target = { handle: 1, persons: [] } as unknown as RoleItem
    const unrelated = { handle: 2, persons: [] } as unknown as RoleItem

    const added = updateRoleMembership(target, 1, person, true)
    const unchanged = updateRoleMembership(unrelated, 1, person, true)
    const removed = updateRoleMembership(added, 1, person, false)

    expect(added.persons?.map((item) => item.handle)).toEqual([7])
    expect(unchanged).toBe(unrelated)
    expect(removed.persons).toEqual([])
  })
})
