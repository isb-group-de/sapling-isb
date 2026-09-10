import { randomUUID } from 'node:crypto';
import type { McpToolDescriptor, McpInlineToolExecution } from './mcp.service';
import type { McpToolPolicy } from './mcp-policy.types';

export const FORM_PROPOSAL_TOOL = 'frontend_form_propose';
export const FORM_PROPOSAL_SERVER = 'sapling-form';
export type FormField = {
  name: string;
  label: string;
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'time'
    | 'reference'
    | 'json'
    | 'multiSelect';
  nullable: boolean;
  referenceEntity?: string;
  choices?: string[];
  integer?: boolean;
};
export type FormContext = {
  formId: string;
  snapshotId: string;
  entityHandle: string;
  recordHandle: string | null;
  mode: 'create' | 'edit';
  fields: FormField[];
};
const safeName = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/.test(value) &&
  !['__proto__', 'prototype', 'constructor'].includes(value);
const safeFieldName = (value: unknown): value is string =>
  safeName(value) ||
  (typeof value === 'string' &&
    value.startsWith('customFields.') &&
    safeName(value.slice('customFields.'.length)));
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function readFormContext(
  value: unknown,
  policy?: McpToolPolicy,
): FormContext | null {
  if (
    !record(value) ||
    !safeName(value.entityHandle) ||
    !['create', 'edit'].includes(String(value.mode)) ||
    typeof value.formId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(value.formId) ||
    typeof value.snapshotId !== 'string' ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(value.snapshotId) ||
    !(
      value.recordHandle === null ||
      (typeof value.recordHandle === 'string' &&
        value.recordHandle.length <= 128)
    ) ||
    !Array.isArray(value.fields) ||
    value.fields.length > 200
  )
    return null;
  if (
    policy?.allowedEntityHandles?.length &&
    !policy.allowedEntityHandles.includes(value.entityHandle)
  )
    return null;
  // This tool only prepares a local draft. It never executes a generic mutation.
  if (
    policy?.allowedInternalTools?.length &&
    !policy.allowedInternalTools.includes(FORM_PROPOSAL_TOOL) &&
    !policy.allowedInternalTools.includes(
      value.mode === 'create' ? 'generic_create' : 'generic_update',
    )
  )
    return null;
  const fields: FormField[] = [];
  for (const field of value.fields) {
    if (
      !record(field) ||
      !safeFieldName(field.name) ||
      typeof field.label !== 'string' ||
      field.label.length > 200 ||
      ![
        'string',
        'number',
        'boolean',
        'date',
        'datetime',
        'time',
        'reference',
        'json',
        'multiSelect',
      ].includes(String(field.type)) ||
      typeof field.nullable !== 'boolean' ||
      fields.some((item) => item.name === field.name)
    )
      return null;
    if (field.type === 'reference' && !safeName(field.referenceEntity))
      return null;
    if (
      field.choices !== undefined &&
      (!Array.isArray(field.choices) ||
        field.choices.length > 200 ||
        field.choices.some(
          (item) => typeof item !== 'string' || item.length > 500,
        ))
    )
      return null;
    fields.push({
      name: field.name,
      label: field.label,
      type: field.type as FormField['type'],
      nullable: field.nullable,
      ...(field.type === 'reference'
        ? { referenceEntity: String(field.referenceEntity) }
        : {}),
      ...(Array.isArray(field.choices)
        ? { choices: field.choices as string[] }
        : {}),
      integer: field.integer === true,
    });
  }
  if (!fields.length) return null;
  return {
    formId: value.formId,
    snapshotId: value.snapshotId,
    entityHandle: value.entityHandle,
    recordHandle: value.recordHandle,
    mode: value.mode as FormContext['mode'],
    fields,
  };
}
export function formProposalDescriptor(
  context: FormContext,
): McpToolDescriptor {
  return {
    serverHandle: 0,
    serverName: FORM_PROPOSAL_SERVER,
    toolName: FORM_PROPOSAL_TOOL,
    description:
      'Propose fields for the currently open ' +
      context.entityHandle +
      ' form. This does NOT save records. User reviews and applies selected values in the form, then uses normal validation and Save. Use for requests to fill/edit the open form instead of generic_create/update. Never claim data was saved. Only supplied fields change. Resolve reference handles with permitted read tools; never invent handles. Date-times use local YYYY-MM-DDTHH:mm, dates YYYY-MM-DD. Existing unsaved values are not shared. Ask the user when required information is missing.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            context.fields.map((field) => [
              field.name,
              {
                description:
                  field.label +
                  (field.referenceEntity
                    ? ' (existing ' + field.referenceEntity + ' handle)'
                    : '') +
                  ' [' +
                  field.type +
                  ']',
                ...(field.type === 'json'
                  ? {}
                  : field.type === 'reference'
                    ? {
                        type: [
                          'string',
                          'number',
                          ...(field.nullable ? ['null'] : []),
                        ],
                      }
                    : {
                        type: [
                          field.type === 'number'
                            ? field.integer
                              ? 'integer'
                              : 'number'
                            : field.type === 'boolean'
                              ? 'boolean'
                              : field.type === 'multiSelect'
                                ? 'array'
                                : 'string',
                          ...(field.nullable ? ['null'] : []),
                        ],
                        ...(field.type === 'multiSelect'
                          ? {
                              items: {
                                type: 'string',
                                ...(field.choices
                                  ? { enum: field.choices }
                                  : {}),
                              },
                            }
                          : field.choices
                            ? {
                                enum: [
                                  ...field.choices,
                                  ...(field.nullable ? [null] : []),
                                ],
                              }
                            : {}),
                      }),
              },
            ]),
          ),
        },
      },
      required: ['fields'],
      additionalProperties: false,
    },
  };
}
export function executeFormProposal(
  context: FormContext | null,
  args: Record<string, unknown>,
): McpInlineToolExecution {
  let error: string | null = null;
  if (
    !context ||
    !record(args.fields) ||
    Object.keys(args.fields).length === 0 ||
    Object.keys(args.fields).length > 200 ||
    JSON.stringify(args).length > 100000
  )
    error =
      'Form context or proposed fields are invalid. Request a new form context.';
  if (!error && context && record(args.fields)) {
    for (const [name, value] of Object.entries(args.fields)) {
      const field = context.fields.find((item) => item.name === name);
      if (!field || !validValue(field, value)) {
        error = 'Invalid or unavailable form field: ' + name;
        break;
      }
    }
  }
  const rawResult =
    error || !context
      ? { ok: false, error }
      : {
          ok: true,
          saved: false,
          requiresFormReview: true,
          formProposal: {
            id: randomUUID(),
            formId: context.formId,
            snapshotId: context.snapshotId,
            entityHandle: context.entityHandle,
            recordHandle: context.recordHandle,
            fields: Object.entries(args.fields as Record<string, unknown>).map(
              ([name, value]) => ({
                name,
                value,
                label: context.fields.find((field) => field.name === name)!
                  .label,
              }),
            ),
          },
        };
  return {
    serverHandle: 0,
    serverName: FORM_PROPOSAL_SERVER,
    toolName: FORM_PROPOSAL_TOOL,
    arguments: args,
    rawResult,
    modelResult: rawResult,
    content: JSON.stringify(rawResult),
  };
}
function validValue(field: FormField, value: unknown): boolean {
  if (value === null) return field.nullable;
  if (field.type === 'json') return true;
  if (field.type === 'number')
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      (!field.integer || Number.isInteger(value))
    );
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'reference')
    return (
      (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) ||
      (typeof value === 'string' && value.length > 0 && value.length <= 128)
    );
  if (field.type === 'multiSelect')
    return (
      Array.isArray(value) &&
      value.length <= 200 &&
      value.every(
        (item) =>
          typeof item === 'string' &&
          (!field.choices || field.choices.includes(item)),
      )
    );
  if (
    typeof value !== 'string' ||
    value.length > 80000 ||
    (field.choices && !field.choices.includes(value))
  )
    return false;
  if (field.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (field.type === 'datetime')
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
  if (field.type === 'time') return /^\d{2}:\d{2}(:\d{2})?$/.test(value);
  return true;
}
