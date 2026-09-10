import permissions from './json-default/permission/permissionData_0001_insert.json';
import entities from './json-default/entity/entityData_0001_insert.json';
import roles from './json-default/role/roleData_0001_insert.json';
import { ROLE_HANDLE } from './role-handles';

describe('Consolidated permission defaults', () => {
  it('contains exactly one explicit permission per shipped role and entity', () => {
    expect(permissions).toHaveLength(roles.length * entities.length);
    expect(
      new Set(permissions.map((row) => `${row.entity}:${row.role}`)).size,
    ).toBe(permissions.length);
  });
  it('preserves administrator capabilities in the captured baseline', () => {
    for (const entity of entities) {
      expect(
        permissions.find(
          (row) =>
            row.entity === entity.handle && row.role === ROLE_HANDLE.ADMIN,
        ),
      ).toMatchObject({
        allowRead: true,
        allowInsert: entity.canInsert,
        allowUpdate: entity.canUpdate,
        allowDelete: entity.canDelete,
        allowShow: entity.canShow,
      });
    }
  });
  it.each([ROLE_HANDLE.SUPPORT, ROLE_HANDLE.SALES])(
    'retains delivery-status read access for role %s',
    (role) => {
      expect(
        permissions.find(
          (row) => row.entity === 'emailDeliveryStatus' && row.role === role,
        )?.allowRead,
      ).toBe(true);
    },
  );
});
