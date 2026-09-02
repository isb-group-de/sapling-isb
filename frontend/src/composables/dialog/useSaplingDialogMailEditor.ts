import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityTemplate } from '@/entity/structure'
import type {
  AttachmentOption,
  EmailTemplateItem,
  InsertTarget,
  MailComposerPlaceholderTarget,
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
import { useSaplingMailEditorRecipients } from './useSaplingMailEditorRecipients'
import { useSaplingMailEditorTranslations } from './useSaplingMailEditorTranslations'
import {
  isScalarPlaceholderTemplate,
  isSupportedPlaceholderRelation,
} from './saplingMailPlaceholder.utils'

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
  const { translate, translateIfExists, translateTemplateLabel, translateWithParams } =
    useSaplingMailEditorTranslations({
      t: (key, params) => String(t(key, params ?? {})),
      te,
    })
  const {
    translationService,
    isLoading: isTranslationLoading,
    loadTranslations,
  } = useTranslationLoader('global', 'navigation', 'document', 'mail')

  const templates = ref<EmailTemplateItem[]>([])
  const composer = ref<MailComposerPlaceholderTarget | null>(null)
  const placeholders = ref<PlaceholderItem[]>([])
  const availableAttachments = ref<AttachmentOption[]>([])
  const contextEntityTemplates = ref<EntityTemplate[]>([])
  const defaultTemplateHandle = ref<number | null>(null)
  const templateHandle = ref<number | null>(null)
  const attachmentHandles = ref<number[]>([])
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
  const isPreviewLoading = ref(false)
  const isSending = ref(false)
  let initializationSequence = 0
  const {
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
  } = useSaplingMailEditorRecipients({
    context,
    contextEntityTemplates,
    currentPermissionStore,
    currentPersonStore,
    locale,
    defaultTemplateHandle,
    isCurrentSequence: (sequence) => sequence === initializationSequence && isOpen.value,
    pushMessage,
  })

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
      const sequence = ++initializationSequence
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
      await Promise.all([
        loadPlaceholders(),
        loadRecipientOptions(),
        loadConfiguredCustomerCc(sequence),
      ])
      if (sequence !== initializationSequence) {
        return
      }
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
