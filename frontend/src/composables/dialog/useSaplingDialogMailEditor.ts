import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate } from '@/entity/structure'
import type {
  AttachmentOption,
  EmailTemplateItem,
  InsertTarget,
  MailRecipientOption,
  MailSenderOption,
  PlaceholderItem,
  PlaceholderRelationTemplates,
} from '@/components/dialog/mail/SaplingDialogMail.types'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import ApiGenericService from '@/services/api.generic.service'
import ApiMailService from '@/services/api.mail.service'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import {
  buildMailRecipientOptions,
  getContextCompanyHandles,
  getContextCompanyTemplates,
  type MailRecipientPerson,
} from '@/utils/saplingMailRecipientOptions'

type MailComposerPlaceholderTarget = {
  insertPlaceholderAtCursor?: (target: InsertTarget, token: string) => void
}

type AttachmentItem = {
  handle: number
  filename: string
  mimetype: string
  description?: string | null
  createdAt?: string | null
}

export function useSaplingDialogMailEditor() {
  const { isOpen, context, closeMailDialog } = useSaplingMailDialog()
  const { pushMessage } = useSaplingMessageCenter()
  const currentPersonStore = useCurrentPersonStore()
  const currentPermissionStore = useCurrentPermissionStore()
  const { locale, t, te } = useI18n()
  const {
    translationService,
    isLoading: isTranslationLoading,
    loadTranslations,
  } = useTranslationLoader('global', 'navigation', 'document', 'mail')

  const templates = ref<EmailTemplateItem[]>([])
  const composer = ref<MailComposerPlaceholderTarget | null>(null)
  const placeholders = ref<PlaceholderItem[]>([])
  const availableAttachments = ref<AttachmentOption[]>([])
  const senderOptions = ref<MailSenderOption[]>([])
  const recipientOptions = ref<MailRecipientOption[]>([])
  const contextEntityTemplates = ref<EntityTemplate[]>([])
  const defaultTemplateHandle = ref<number | null>(null)
  const templateHandle = ref<number | null>(null)
  const attachmentHandles = ref<number[]>([])
  const toRecipients = ref<string[]>([])
  const ccRecipients = ref<string[]>([])
  const bccRecipients = ref<string[]>([])
  const selectedSenderEmail = ref('')
  const subject = ref('')
  const bodyMarkdown = ref('')
  const insertTarget = ref<InsertTarget>('body')
  const previewMarkdown = ref('')
  const previewSubject = ref('')
  const previewTo = ref('')
  const previewCc = ref('')
  const previewBcc = ref('')
  const isLoadingTemplates = ref(false)
  const isLoadingPlaceholders = ref(false)
  const isLoadingAttachments = ref(false)
  const isLoadingSenderOptions = ref(false)
  const isLoadingRecipientOptions = ref(false)
  const isPreviewLoading = ref(false)
  const isSending = ref(false)

  const entityLabel = computed(() => {
    const handle = context.value?.entityHandle

    if (!handle) {
      return ''
    }

    return translateIfExists(`navigation.${handle}`, handle)
  })

  const senderEmail = computed(
    () => selectedSenderEmail.value || currentPersonStore.person?.email?.trim() || '',
  )

  const canSendMail = computed(
    () =>
      !currentPersonStore.isImpersonating &&
      hasEntityPermission(context.value?.entityHandle, 'allowUpdate'),
  )

  const dialogTitle = computed(() => {
    if (!context.value?.entityHandle) {
      return translate('mail.compose')
    }

    return translateWithParams('mail.composeForEntity', {
      entity: context.value.recordLabel?.trim() || entityLabel.value,
    })
  })

  const heroStats = computed(() => [
    { label: translate('mail.recipientsStat'), value: toRecipients.value.length },
    { label: translate('mail.templatesStat'), value: templates.value.length },
    { label: translate('mail.attachmentsStat'), value: attachmentHandles.value.length },
  ])

  const placeholderGroups = computed(() => {
    const groups = new Map<string, PlaceholderItem[]>()

    for (const placeholder of placeholders.value) {
      const current = groups.get(placeholder.group) ?? []
      current.push(placeholder)
      groups.set(placeholder.group, current)
    }

    return [...groups.entries()].map(([name, items]) => ({
      name,
      items,
    }))
  })

  const attachmentSelectionSummary = computed(() => {
    if (attachmentHandles.value.length === 0) {
      return ''
    }

    return availableAttachments.value
      .filter((attachment) => attachmentHandles.value.includes(attachment.handle))
      .map((attachment) => attachment.filename)
      .join(', ')
  })

  watch(
    isOpen,
    async (open) => {
      if (!open || !context.value) {
        resetState()
        return
      }

      initializeFromContext()
      await Promise.all([
        loadTranslations(),
        currentPersonStore.fetchCurrentPerson(),
        currentPermissionStore.fetchCurrentPermission(),
      ])
      await Promise.all([loadTemplates(), loadAttachments(), loadSenderOptions()])
      applyContextDefaultTemplate()
      isLoadingRecipientOptions.value = true
      await loadContextEntityTemplates()
      await Promise.all([loadPlaceholders(), loadRecipientOptions()])
      await refreshPreview()
    },
    { immediate: true },
  )

  function handleVisibilityChange(value: boolean) {
    if (!value) {
      closeMailDialog()
    }
  }

  function initializeFromContext() {
    toRecipients.value = normalizeRecipients(context.value?.initialTo)
    ccRecipients.value = []
    bccRecipients.value = []
    subject.value = context.value?.initialSubject ?? ''
    bodyMarkdown.value = ''
    templateHandle.value = null
    attachmentHandles.value = []
    insertTarget.value = 'body'
  }

  function resetState() {
    templates.value = []
    placeholders.value = []
    availableAttachments.value = []
    senderOptions.value = []
    recipientOptions.value = []
    contextEntityTemplates.value = []
    defaultTemplateHandle.value = null
    templateHandle.value = null
    attachmentHandles.value = []
    toRecipients.value = []
    ccRecipients.value = []
    bccRecipients.value = []
    selectedSenderEmail.value = ''
    subject.value = ''
    bodyMarkdown.value = ''
    insertTarget.value = 'body'
    previewMarkdown.value = ''
    previewSubject.value = ''
    previewTo.value = ''
    previewCc.value = ''
    previewBcc.value = ''
    isLoadingTemplates.value = false
    isLoadingPlaceholders.value = false
    isLoadingAttachments.value = false
    isLoadingSenderOptions.value = false
    isLoadingRecipientOptions.value = false
    isPreviewLoading.value = false
    isSending.value = false
  }

  async function loadTemplates() {
    if (!context.value?.entityHandle || !hasEntityPermission('emailTemplate', 'allowRead')) {
      templates.value = []
      return
    }

    isLoadingTemplates.value = true

    try {
      const response = await ApiGenericService.findAll<EmailTemplateItem>('emailTemplate', {
        filter: {
          entity: context.value.entityHandle,
          isActive: true,
        },
        orderBy: {
          name: 'ASC',
        },
        relations: ['entity'],
      })

      templates.value = response
    } catch (error) {
      console.error('Error loading email templates:', error)
      pushMessage(
        'warning',
        'mail.templatesLoadFailed',
        'mail.templatesLoadFailedDescription',
        'mail',
      )
      templates.value = []
    } finally {
      isLoadingTemplates.value = false
    }
  }

  async function applyTemplate() {
    const selectedTemplate = templates.value.find(
      (template) => template.handle === templateHandle.value,
    )
    if (selectedTemplate) {
      subject.value = selectedTemplate.subjectTemplate
      bodyMarkdown.value = selectedTemplate.bodyMarkdown
    }

    await refreshPreview()
  }

  function applyContextDefaultTemplate() {
    const configuredTemplate = templates.value.find(
      (template) => template.handle === defaultTemplateHandle.value,
    )
    if (!configuredTemplate) {
      return
    }

    templateHandle.value = configuredTemplate.handle
    if (!subject.value.trim()) {
      subject.value = configuredTemplate.subjectTemplate
    }
    bodyMarkdown.value = configuredTemplate.bodyMarkdown
  }

  async function loadContextEntityTemplates() {
    if (!context.value?.entityHandle) {
      return
    }

    isLoadingPlaceholders.value = true

    try {
      contextEntityTemplates.value = await ApiMailService.getEntityTemplate(
        context.value.entityHandle,
        { reportError: false },
      )
    } catch (error) {
      console.error('Error loading context entity templates:', error)
      pushMessage(
        'warning',
        'mail.placeholdersLoadFailed',
        'mail.placeholdersLoadFailedDescription',
        'mail',
      )
      contextEntityTemplates.value = []
      placeholders.value = []
      isLoadingPlaceholders.value = false
    }
  }

  async function loadPlaceholders() {
    if (!context.value?.entityHandle || contextEntityTemplates.value.length === 0) {
      placeholders.value = []
      isLoadingPlaceholders.value = false
      return
    }

    isLoadingPlaceholders.value = true

    try {
      const rootTemplates = contextEntityTemplates.value
      const relationResults = await Promise.all(
        rootTemplates
          .filter(isSupportedPlaceholderRelation)
          .filter((template) => hasEntityPermission(template.referenceName, 'allowRead'))
          .map(async (template): Promise<PlaceholderRelationTemplates | null> => {
            try {
              return {
                parent: template,
                children: await ApiMailService.getEntityTemplate(template.referenceName ?? '', {
                  reportError: false,
                }),
              }
            } catch (error) {
              console.error(
                `Error loading placeholder relation ${template.referenceName ?? ''}:`,
                error,
              )
              return null
            }
          }),
      )
      const relatedTemplates = relationResults.filter(
        (relation): relation is PlaceholderRelationTemplates => relation !== null,
      )

      await loadPlaceholderTranslations(relatedTemplates)

      placeholders.value = buildPlaceholderItems(rootTemplates, relatedTemplates)
    } catch (error) {
      console.error('Error loading placeholders:', error)
      pushMessage(
        'warning',
        'mail.placeholdersLoadFailed',
        'mail.placeholdersLoadFailedDescription',
        'mail',
      )
      placeholders.value = []
    } finally {
      isLoadingPlaceholders.value = false
    }
  }

  async function loadAttachments() {
    if (!context.value?.entityHandle || context.value.itemHandle == null) {
      availableAttachments.value = []
      attachmentHandles.value = []
      return
    }

    if (!hasEntityPermission('document', 'allowRead')) {
      availableAttachments.value = []
      attachmentHandles.value = []
      return
    }

    isLoadingAttachments.value = true

    try {
      const response = await ApiGenericService.findAll<AttachmentItem>('document', {
        filter: {
          reference: String(context.value.itemHandle),
          entity: context.value.entityHandle,
        },
        orderBy: {
          createdAt: 'DESC',
        },
      })

      availableAttachments.value = response.map((document) => ({
        handle: document.handle,
        filename: document.filename,
        title: document.description
          ? `${document.filename} - ${document.description}`
          : `${document.filename} (${document.mimetype})`,
      }))
    } catch (error) {
      console.error('Error loading attachments:', error)
      pushMessage(
        'warning',
        'mail.attachmentsLoadFailed',
        'mail.attachmentsLoadFailedDescription',
        'mail',
      )
      availableAttachments.value = []
    } finally {
      isLoadingAttachments.value = false
    }
  }

  async function loadRecipientOptions() {
    recipientOptions.value = []

    const currentContext = context.value
    const companyTemplates = getContextCompanyTemplates(contextEntityTemplates.value)
    const currentCompanyHandle = getRelationHandle(currentPersonStore.person?.company)
    const canReadPeople =
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === 'person' && permission.allowRead === true,
      ) === true

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

      if (companyHandles.length === 0) {
        return
      }

      const people = await ApiGenericService.findAll<MailRecipientPerson>('person', {
        filter: {
          company: {
            $in: companyHandles,
          },
        },
        orderBy: {
          lastName: 'ASC',
          firstName: 'ASC',
        },
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

      recipientOptions.value = buildMailRecipientOptions(people, locale.value, currentCompanyHandle)
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
    const currentContext = context.value
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

    return {
      ...(response.data[0] ?? {}),
      ...draftValues,
    }
  }

  async function loadSenderOptions() {
    isLoadingSenderOptions.value = true

    try {
      const response = await ApiMailService.listSenders(context.value?.entityHandle)
      senderOptions.value = response.senders ?? []
      defaultTemplateHandle.value = response.defaultTemplateHandle ?? null
      selectedSenderEmail.value =
        senderOptions.value.find((sender) => sender.isDefault)?.email ??
        senderOptions.value[0]?.email ??
        currentPersonStore.person?.email?.trim() ??
        ''
    } catch (error) {
      console.error('Error loading sender options:', error)
      pushMessage(
        'warning',
        'mail.senderOptionsLoadFailed',
        'mail.senderOptionsLoadFailedDescription',
        'mail',
      )
      senderOptions.value = []
      defaultTemplateHandle.value = null
      selectedSenderEmail.value = currentPersonStore.person?.email?.trim() ?? ''
    } finally {
      isLoadingSenderOptions.value = false
    }
  }

  async function refreshPreview() {
    if (!context.value?.entityHandle) {
      return
    }

    isPreviewLoading.value = true

    try {
      const preview = await ApiMailService.preview({
        entityHandle: context.value.entityHandle,
        itemHandle: context.value.itemHandle,
        templateHandle: templateHandle.value ?? undefined,
        senderEmail: selectedSenderEmail.value || undefined,
        subject: subject.value,
        bodyMarkdown: bodyMarkdown.value,
        to: toRecipients.value,
        cc: ccRecipients.value,
        bcc: bccRecipients.value,
        draftValues: context.value.draftValues,
        attachmentHandles: attachmentHandles.value,
      })

      previewMarkdown.value = preview.bodyMarkdown
      previewSubject.value = preview.subject
      previewTo.value = preview.to.join(', ')
      previewCc.value = preview.cc.join(', ')
      previewBcc.value = preview.bcc.join(', ')
    } catch (error) {
      console.error('Error previewing email:', error)
      pushMessage('error', 'mail.previewFailed', 'mail.previewFailedDescription', 'mail')
    } finally {
      isPreviewLoading.value = false
    }
  }

  async function sendMail() {
    if (!context.value?.entityHandle || !canSendMail.value) {
      return
    }

    isSending.value = true

    try {
      await ApiMailService.send({
        entityHandle: context.value.entityHandle,
        itemHandle: context.value.itemHandle,
        templateHandle: templateHandle.value ?? undefined,
        senderEmail: selectedSenderEmail.value || undefined,
        subject: subject.value,
        bodyMarkdown: bodyMarkdown.value,
        to: toRecipients.value,
        cc: ccRecipients.value,
        bcc: bccRecipients.value,
        draftValues: context.value.draftValues,
        attachmentHandles: attachmentHandles.value,
      })

      pushMessage('success', 'mail.sendQueued', 'mail.sendQueuedDescription', 'mail')
      closeMailDialog()
    } catch (error) {
      console.error('Error sending email:', error)
      pushMessage('error', 'mail.sendFailed', 'mail.sendFailedDescription', 'mail')
    } finally {
      isSending.value = false
    }
  }

  function insertPlaceholder(token: string) {
    composer.value?.insertPlaceholderAtCursor?.(insertTarget.value, token)
  }

  function hasEntityPermission(
    entityHandle: string | null | undefined,
    action: 'allowRead' | 'allowUpdate',
  ): boolean {
    if (!entityHandle) {
      return false
    }

    return (
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === entityHandle && permission[action] === true,
      ) === true
    )
  }

  function buildPlaceholderItems(
    rootTemplates: EntityTemplate[],
    relationTemplates: PlaceholderRelationTemplates[],
  ): PlaceholderItem[] {
    const items: PlaceholderItem[] = []
    const currentEntityHandle = context.value?.entityHandle ?? ''

    for (const template of rootTemplates.filter(isScalarPlaceholderTemplate)) {
      items.push({
        token: `{{${template.name}}}`,
        label: translateTemplateLabel(currentEntityHandle, template.name),
        group: entityLabel.value || translate('mail.placeholderGroupCurrent'),
      })
    }

    for (const relation of relationTemplates) {
      const relationEntityHandle = relation.parent.referenceName ?? ''

      for (const child of relation.children.filter(isScalarPlaceholderTemplate)) {
        items.push({
          token: `{{${relation.parent.name}.${child.name}}}`,
          label: translateTemplateLabel(relationEntityHandle, child.name),
          group: translateTemplateLabel(currentEntityHandle, relation.parent.name),
        })
      }
    }

    return items
      .filter(
        (item, index, array) =>
          array.findIndex((candidate) => candidate.token === item.token) === index,
      )
      .sort((left, right) => left.label.localeCompare(right.label))
  }

  function isScalarPlaceholderTemplate(template: EntityTemplate): boolean {
    return !template.isReference && template.isPersistent !== false
  }

  function isSupportedPlaceholderRelation(template: EntityTemplate): boolean {
    return !!template.isReference && !!template.referenceName && template.kind !== '1:m'
  }

  async function loadPlaceholderTranslations(relationTemplates: PlaceholderRelationTemplates[]) {
    const namespaces = new Set<string>()
    const currentEntityHandle = context.value?.entityHandle

    if (currentEntityHandle) {
      namespaces.add(currentEntityHandle)
    }

    for (const relation of relationTemplates) {
      if (relation.parent.referenceName) {
        namespaces.add(relation.parent.referenceName)
      }
    }

    if (namespaces.size === 0) {
      return
    }

    await translationService.value.prepare(...namespaces)
  }

  function normalizeRecipients(value: string[] | string | null | undefined): string[] {
    const values = Array.isArray(value) ? value : String(value ?? '').split(/[;,]/)

    return values.map((entry) => String(entry).trim()).filter(Boolean)
  }

  function getRelationHandle(value: unknown): string | number | null {
    if (typeof value === 'string' || typeof value === 'number') {
      return value
    }

    if (!value || typeof value !== 'object') {
      return null
    }

    const handle = (value as { handle?: unknown }).handle
    return typeof handle === 'string' || typeof handle === 'number' ? handle : null
  }

  function distinctHandles(handles: Array<string | number>): Array<string | number> {
    const distinct = new Map<string, string | number>()

    for (const handle of handles) {
      const key = String(handle).trim()
      if (key && !distinct.has(key)) {
        distinct.set(key, handle)
      }
    }

    return [...distinct.values()]
  }

  function translateTemplateLabel(entityHandle: string, property: string): string {
    if (!entityHandle) {
      return property
    }

    return translateIfExists(`${entityHandle}.${property}`, property)
  }

  function translate(key: string): string {
    return t(key)
  }

  function translateIfExists(key: string, fallback: string): string {
    return te(key) ? t(key) : fallback
  }

  function translateWithParams(key: string, params: Record<string, unknown>): string {
    return te(key) ? t(key, params) : key
  }

  return {
    applyTemplate,
    availableAttachments,
    attachmentHandles,
    attachmentSelectionSummary,
    bccRecipients,
    bodyMarkdown,
    canSendMail,
    ccRecipients,
    closeMailDialog,
    composer,
    context,
    dialogTitle,
    handleVisibilityChange,
    heroStats,
    insertPlaceholder,
    insertTarget,
    isLoadingAttachments,
    isLoadingPlaceholders,
    isLoadingRecipientOptions,
    isLoadingSenderOptions,
    isLoadingTemplates,
    isOpen,
    isPreviewLoading,
    isSending,
    isTranslationLoading,
    placeholderGroups,
    previewBcc,
    previewCc,
    previewMarkdown,
    previewSubject,
    previewTo,
    recipientOptions,
    refreshPreview,
    selectedSenderEmail,
    sendMail,
    senderEmail,
    senderOptions,
    subject,
    templateHandle,
    templates,
    toRecipients,
    translate,
  }
}
