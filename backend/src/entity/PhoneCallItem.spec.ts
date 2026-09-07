import { describe, expect, it } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { FieldPermissionService } from '../api/current/field-permission.service';
import type { EntityTemplateDto } from '../api/template/dto/entity-template.dto';
import type { PersonItem } from './PersonItem';
import {
  getSaplingFormLayout,
  getSaplingGenericReference,
  getSaplingOptions,
} from './global/entity.decorator';
import { PhoneCallItem } from './PhoneCallItem';

describe('PhoneCallItem metadata', () => {
  it('exposes its source record as a visible generic reference', () => {
    expect(getSaplingOptions(PhoneCallItem.prototype, 'entity')).toEqual(
      expect.arrayContaining(['isEntity']),
    );
    expect(
      getSaplingGenericReference(PhoneCallItem.prototype, 'reference'),
    ).toEqual({
      entityField: 'entity',
      handleField: 'reference',
    });
    expect(getSaplingFormLayout(PhoneCallItem.prototype, 'reference')).toEqual(
      expect.objectContaining({
        group: 'phoneCall.groupReference',
        formVisible: true,
        tableVisible: true,
        mobileVisible: true,
      }),
    );
  });
});

describe('PhoneCallItem create permissions', () => {
  const payload = {
    phoneNumber: '+49 30 1234567',
    note: 'Please call back.',
    reached: false,
    entity: 'person',
    reference: '42',
    person: 7,
  };
  const templates = [...Object.keys(payload), 'createdAt'].map(
    (name) =>
      ({
        name,
        options: getSaplingOptions(PhoneCallItem.prototype, name),
        isPersistent: true,
        isAutoIncrement: false,
        isReference: ['entity', 'person'].includes(name),
      }) as EntityTemplateDto,
  );
  const service = new FieldPermissionService(
    {} as never,
    {} as never,
    {} as never,
  );
  const currentUser = (allowInsert = true, denyEntityField = false) =>
    ({
      handle: 7,
      roles: [
        {
          stage: { handle: 'global' },
          permissions: [
            {
              entity: { handle: 'phoneCall' },
              allowInsert,
              fieldPermissions: denyEntityField
                ? [{ fieldName: 'entity', allowInsert: false }]
                : [],
            },
          ],
        },
      ],
    }) as unknown as PersonItem;

  it('accepts the phone dialog payload with inherited insert permission', async () => {
    await expect(
      service.assertPayloadAccess(
        currentUser(),
        'phoneCall',
        payload,
        'insert',
        undefined,
        templates,
      ),
    ).resolves.toBeUndefined();
  });

  it('still rejects an explicit field permission denial', async () => {
    await expect(
      service.assertPayloadAccess(
        currentUser(true, true),
        'phoneCall',
        payload,
        'insert',
        undefined,
        templates,
      ),
    ).rejects.toMatchObject({
      response: {
        message: 'global.fieldPermissionDenied',
        details: {
          entityHandle: 'phoneCall',
          fieldName: 'entity',
          action: 'insert',
        },
      },
    });
  });

  it('still requires entity insert permission', async () => {
    await expect(
      service.assertPayloadAccess(
        currentUser(false),
        'phoneCall',
        payload,
        'insert',
        undefined,
        templates,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps server-managed timestamps structurally read-only', async () => {
    await expect(
      service.assertPayloadAccess(
        currentUser(),
        'phoneCall',
        { createdAt: new Date() },
        'insert',
        undefined,
        templates,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
