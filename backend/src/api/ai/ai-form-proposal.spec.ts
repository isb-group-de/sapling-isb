import {
  executeFormProposal,
  formProposalDescriptor,
  readFormContext,
} from './ai-form-proposal';
const context = {
  formId: 'form-1',
  snapshotId: 'request-1',
  entityHandle: 'company',
  recordHandle: null,
  mode: 'create',
  fields: [
    { name: 'name', label: 'Name', type: 'string', nullable: false },
    {
      name: 'employees',
      label: 'Mitarbeiter',
      type: 'number',
      integer: true,
      nullable: true,
    },
  ],
};
describe('Frontend form proposals', () => {
  it('offers a bounded draft tool and returns a proposal without saving', () => {
    const parsed = readFormContext(context);
    expect(parsed).not.toBeNull();
    expect(formProposalDescriptor(parsed!).toolName).toBe(
      'frontend_form_propose',
    );
    const result = executeFormProposal(parsed, {
      fields: { name: 'Example', employees: 0 },
    });
    expect(result.rawResult).toMatchObject({
      ok: true,
      saved: false,
      formProposal: {
        formId: 'form-1',
        snapshotId: 'request-1',
        entityHandle: 'company',
        recordHandle: null,
      },
    });
  });
  it('rejects unavailable fields, prototype keys, malformed and empty proposals', () => {
    const parsed = readFormContext(context);
    for (const fields of [
      { handle: 2 },
      { employees: 1.5 },
      { name: null },
      {},
      JSON.parse('{"__proto__":{"admin":true}}') as unknown,
    ]) {
      expect(executeFormProposal(parsed, { fields }).rawResult).toEqual(
        expect.objectContaining({ ok: false }),
      );
    }
    expect(
      readFormContext({
        ...context,
        fields: [{ ...context.fields[0], name: '__proto__' }],
      }),
    ).toBeNull();
    expect(
      executeFormProposal(null, { fields: { name: 'Other' } }).rawResult,
    ).toEqual(expect.objectContaining({ ok: false }));
  });
  it('preserves entity/tool restrictions and does not treat read-only as permission to save', () => {
    expect(
      readFormContext(context, { allowedEntityHandles: ['ticket'] }),
    ).toBeNull();
    expect(
      readFormContext(context, { allowedInternalTools: ['generic_get'] }),
    ).toBeNull();
    expect(
      readFormContext(context, {
        allowedInternalTools: ['generic_create'],
        blockMutatingTools: true,
      }),
    ).not.toBeNull();
  });
  it('supports custom fields without accepting arbitrary property paths', () => {
    const custom = readFormContext({
      ...context,
      fields: [
        {
          name: 'customFields.note',
          label: 'Note',
          type: 'string',
          nullable: true,
        },
      ],
    });
    expect(custom).not.toBeNull();
    expect(
      executeFormProposal(custom, { fields: { 'customFields.note': 'Draft' } })
        .rawResult,
    ).toMatchObject({ ok: true, saved: false });
    expect(
      readFormContext({
        ...context,
        fields: [
          {
            name: 'customFields.__proto__',
            label: 'Invalid',
            type: 'json',
            nullable: true,
          },
        ],
      }),
    ).toBeNull();
  });
});
