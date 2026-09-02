import { ref, type Ref } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import type {
  MailRecipientOption,
  MailSenderOption,
} from '@/components/dialog/mail/SaplingDialogMail.types'
import { useSaplingMailDialog } from './useSaplingMailDialog'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import ApiGenericService from '@/services/api.generic.service'
import ApiMailService from '@/services/api.mail.service'
import {
  buildMailRecipientOptions,
  getContextCompanyHandles,
  getContextCompanyTemplates,
  type MailRecipientPerson,
} from '@/utils/saplingMailRecipientOptions'

type PushMessage = (
  type: 'success' | 'info' | 'warning' | 'error',
  message: string,
  description: string,
  entity: string,
  technical?: unknown,
  descriptionParams?: Record<string, unknown>,
) => void

export function useSaplingMailEditorRecipients(options: {
  context: ReturnType<typeof useSaplingMailDialog>['context']
  contextEntityTemplates: Ref<EntityTemplate[]>
  currentPermissionStore: ReturnType<typeof useCurrentPermissionStore>
  currentPersonStore: ReturnType<typeof useCurrentPersonStore>
  locale: Ref<string>
  defaultTemplateHandle: Ref<number | null>
  isCurrentSequence: (sequence: number) => boolean
  pushMessage: PushMessage
}) {
  const senderOptions = ref<MailSenderOption[]>([])
  const recipientOptions = ref<MailRecipientOption[]>([])
  const toRecipients = ref<string[]>([])
  const ccRecipients = ref<string[]>([])
  const bccRecipients = ref<string[]>([])
  const selectedSenderEmail = ref('')
  const isLoadingSenderOptions = ref(false)
  const isLoadingRecipientOptions = ref(false)

  function hasEntityPermission(
    entityHandle: string | null | undefined,
    action: 'allowRead' | 'allowUpdate',
  ): boolean {
    if (!entityHandle) return false
    return (
      options.currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === entityHandle && permission[action] === true,
      ) === true
    )
  }

  async function loadRecipientOptions() {
    recipientOptions.value = []
    const currentContext = options.context.value
    const companyTemplates = getContextCompanyTemplates(options.contextEntityTemplates.value)
    const currentCompanyHandle = getRelationHandle(options.currentPersonStore.person?.company)
    const canReadPeople = hasEntityPermission('person', 'allowRead')
    if (
      !currentContext ||
      (companyTemplates.length === 0 && currentCompanyHandle == null) ||
      !canReadPeople
    ) {
      isLoadingRecipientOptions.value = false
      return
    }
    isLoadingRecipientOptions.value = true
    try {
      const contextValues =
        companyTemplates.length > 0 ? await loadContextCompanyValues(companyTemplates) : {}
      const companyHandles = distinctHandles([
        ...getContextCompanyHandles(companyTemplates, contextValues, currentContext.itemHandle),
        ...(currentCompanyHandle == null ? [] : [currentCompanyHandle]),
      ])
      if (companyHandles.length === 0) return
      const people = await ApiGenericService.findAll<MailRecipientPerson>('person', {
        filter: { company: { $in: companyHandles } },
        orderBy: { lastName: 'ASC', firstName: 'ASC' },
        relations: ['company', 'department'],
        fields: [
          'handle',
          'firstName',
          'lastName',
          'email',
          'isActive',
          'company',
          'company.handle',
          'company.name',
          'department',
          'department.description',
        ],
      })
      recipientOptions.value = buildMailRecipientOptions(
        people,
        options.locale.value,
        currentCompanyHandle,
      )
    } catch (error) {
      console.error('Error loading context mail recipients:', error)
      recipientOptions.value = []
    } finally {
      isLoadingRecipientOptions.value = false
    }
  }

  async function loadContextCompanyValues(
    companyTemplates: EntityTemplate[],
  ): Promise<Record<string, unknown>> {
    const currentContext = options.context.value
    const draftValues = currentContext?.draftValues ?? {}
    const missingReferences = companyTemplates.filter(
      (template) =>
        template.isReference === true &&
        !Object.prototype.hasOwnProperty.call(draftValues, template.name),
    )
    if (!currentContext || currentContext.itemHandle == null || missingReferences.length === 0) {
      return draftValues
    }
    const relationNames = missingReferences.map((template) => template.name)
    const response = await ApiGenericService.find<Record<string, unknown>>(
      currentContext.entityHandle,
      {
        filter: { handle: currentContext.itemHandle },
        page: 1,
        limit: 1,
        relations: relationNames,
        fields: [
          'handle',
          ...relationNames,
          ...relationNames.map((relationName) => `${relationName}.handle`),
        ],
      },
    )
    return { ...(response.data[0] ?? {}), ...draftValues }
  }

  async function loadSenderOptions() {
    isLoadingSenderOptions.value = true
    try {
      const response = await ApiMailService.listSenders(options.context.value?.entityHandle)
      senderOptions.value = response.senders ?? []
      options.defaultTemplateHandle.value = response.defaultTemplateHandle ?? null
      selectedSenderEmail.value =
        senderOptions.value.find((sender) => sender.isDefault)?.email ??
        senderOptions.value[0]?.email ??
        options.currentPersonStore.person?.email?.trim() ??
        ''
    } catch (error) {
      console.error('Error loading sender options:', error)
      options.pushMessage(
        'warning',
        'mail.senderOptionsLoadFailed',
        'mail.senderOptionsLoadFailedDescription',
        'mail',
      )
      senderOptions.value = []
      options.defaultTemplateHandle.value = null
      selectedSenderEmail.value = options.currentPersonStore.person?.email?.trim() ?? ''
    } finally {
      isLoadingSenderOptions.value = false
    }
  }

  async function loadConfiguredCustomerCc(sequence: number) {
    const currentContext = options.context.value
    if (!currentContext) return
    try {
      const result = await ApiMailService.resolveContextCc(
        {
          entityHandle: currentContext.entityHandle,
          itemHandle: currentContext.itemHandle,
          draftValues: currentContext.draftValues,
          to: toRecipients.value,
          cc: ccRecipients.value,
          bcc: bccRecipients.value,
        },
        { reportError: false },
      )
      if (!options.isCurrentSequence(sequence)) return
      const occupiedRecipients = new Set(
        [...toRecipients.value, ...ccRecipients.value, ...bccRecipients.value].map((recipient) =>
          recipient.trim().toLocaleLowerCase(),
        ),
      )
      const additionalCc = normalizeRecipients(result.additionalCc).filter(
        (recipient) => !occupiedRecipients.has(recipient.toLocaleLowerCase()),
      )
      ccRecipients.value = normalizeDistinctRecipients([...ccRecipients.value, ...additionalCc])
    } catch (error) {
      console.error('Error loading configured customer CC recipients:', error)
      if (options.isCurrentSequence(sequence)) {
        options.pushMessage(
          'warning',
          'mail.customerCcLoadFailed',
          'mail.customerCcLoadFailedDescription',
          'mail',
        )
      }
    }
  }

  function normalizeRecipients(value: string[] | string | null | undefined): string[] {
    const values = Array.isArray(value) ? value : String(value ?? '').split(/[;,]/)
    return values.map((entry) => String(entry).trim()).filter(Boolean)
  }

  function normalizeDistinctRecipients(values: string[]): string[] {
    const distinct = new Map<string, string>()
    for (const recipient of normalizeRecipients(values)) {
      const key = recipient.toLocaleLowerCase()
      if (!distinct.has(key)) distinct.set(key, recipient)
    }
    return [...distinct.values()]
  }

  function getRelationHandle(value: unknown): string | number | null {
    if (typeof value === 'string' || typeof value === 'number') return value
    if (!value || typeof value !== 'object') return null
    const handle = (value as { handle?: unknown }).handle
    return typeof handle === 'string' || typeof handle === 'number' ? handle : null
  }

  function distinctHandles(handles: Array<string | number>): Array<string | number> {
    const distinct = new Map<string, string | number>()
    for (const handle of handles) {
      const key = String(handle).trim()
      if (key && !distinct.has(key)) distinct.set(key, handle)
    }
    return [...distinct.values()]
  }

  return {
    bccRecipients,
    ccRecipients,
    hasEntityPermission,
    isLoadingRecipientOptions,
    isLoadingSenderOptions,
    loadConfiguredCustomerCc,
    loadRecipientOptions,
    loadSenderOptions,
    normalizeRecipients,
    recipientOptions,
    selectedSenderEmail,
    senderOptions,
    toRecipients,
  }
}
