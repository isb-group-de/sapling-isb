import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { AccumulatedPermission, DialogState, EntityTemplate } from '@/entity/structure'
import { buildMailMenuActions } from '@/utils/saplingMailMenuUtil'
import ApiTemplateService from '@/services/api.template.service'
import type { EntityValueReferenceTemplates } from '@/utils/saplingTableUtil'
import {
  getCommunicationOwnerReferenceNames,
  getCommunicationRecordLabel,
} from '@/utils/saplingCommunicationRecordUtil'

interface SupplementalTabProps {
  mode: DialogState
  item: SaplingGenericItem | null
  templates: EntityTemplate[]
  entity: EntityItem | null
}

interface SupplementalTabOptions {
  activeTab: Ref<number>
  form: Ref<SaplingGenericItem>
  informationDirty: Ref<boolean>
  isSmallViewport: ComputedRef<boolean>
  permissions: Ref<AccumulatedPermission[] | null>
  relationTemplates: ComputedRef<EntityTemplate[]>
}

async function loadCommunicationReferenceTemplates(
  initialReferenceNames: string[],
): Promise<EntityValueReferenceTemplates> {
  const loaded: Record<string, EntityTemplate[]> = {}
  const queued = new Set(initialReferenceNames)

  while (queued.size > 0) {
    const referenceNames = [...queued]
    queued.clear()
    const entries = await Promise.all(
      referenceNames.map(async (referenceName) => {
        try {
          return [referenceName, await ApiTemplateService.getEntityTemplate(referenceName)] as const
        } catch {
          return [referenceName, [] as EntityTemplate[]] as const
        }
      }),
    )

    for (const [referenceName, templates] of entries) {
      loaded[referenceName] = templates
      for (const template of templates) {
        const nestedReferenceName = template.referenceName?.trim()
        if (
          template.isReference &&
          template.options?.includes('isValue') &&
          nestedReferenceName &&
          !(nestedReferenceName in loaded)
        ) {
          queued.add(nestedReferenceName)
        }
      }
    }
  }

  return loaded
}

export function useSaplingDialogSupplementalTabs(
  props: SupplementalTabProps,
  {
    activeTab,
    form,
    informationDirty,
    isSmallViewport,
    permissions,
    relationTemplates,
  }: SupplementalTabOptions,
) {
  const { t } = useI18n()
  const itemHandle = computed<string | number | null>(() => {
    const handle = props.item?.handle
    return typeof handle === 'string' || typeof handle === 'number' ? handle : null
  })
  const informationTabIndex = computed(() => relationTemplates.value.length + 1)
  const documentsTabIndex = computed(() => relationTemplates.value.length + 2)
  const emailsTabIndex = computed(() => relationTemplates.value.length + 3)
  const phoneCallsTabIndex = computed(() => relationTemplates.value.length + 4)
  const hasPersistedItem = computed(() => itemHandle.value != null && props.mode !== 'create')
  const permissionFor = (entity: string) =>
    permissions.value?.find((permission) => permission.entityHandle === entity)
  const canShowInformationTab = computed(
    () => !isSmallViewport.value && permissionFor('information')?.allowRead === true,
  )
  const canShowDocumentsTab = computed(
    () => !isSmallViewport.value && permissionFor('document')?.allowRead === true,
  )
  const canShowEmailsTab = computed(
    () => !isSmallViewport.value && permissionFor('emailDelivery')?.allowRead === true,
  )
  const canShowPhoneCallsTab = computed(
    () => !isSmallViewport.value && permissionFor('phoneCall')?.allowRead === true,
  )
  const canUploadDocuments = computed(
    () => hasPersistedItem.value && props.entity?.canInsert === true,
  )
  const canComposeEmails = computed(
    () => hasPersistedItem.value && props.entity?.canUpdate === true,
  )
  const canCreatePhoneCalls = computed(
    () => hasPersistedItem.value && permissionFor('phoneCall')?.allowInsert === true,
  )
  const recordPhoneTemplate = computed(() =>
    props.templates.find((template) => {
      const value = form.value[template.name]
      return (
        template.options?.includes('isPhone') && value != null && String(value).trim().length > 0
      )
    }),
  )
  const recordPhoneNumber = computed(() =>
    recordPhoneTemplate.value
      ? String(form.value[recordPhoneTemplate.value.name] ?? '').trim()
      : '',
  )
  const recordEmailActions = computed(() => buildMailMenuActions(props.templates, form.value))
  const communicationContactTemplateNames = computed(() => [
    ...new Set([
      ...recordEmailActions.value.map((action) => action.templateName),
      ...(recordPhoneTemplate.value ? [recordPhoneTemplate.value.name] : []),
    ]),
  ])
  const communicationReferenceTemplates = ref<EntityValueReferenceTemplates>({})
  let communicationTemplateRequestId = 0

  watch(
    () =>
      getCommunicationOwnerReferenceNames(communicationContactTemplateNames.value, props.templates),
    async (referenceNames) => {
      const requestId = ++communicationTemplateRequestId
      const loadedTemplates = await loadCommunicationReferenceTemplates(referenceNames)
      if (requestId === communicationTemplateRequestId) {
        communicationReferenceTemplates.value = loadedTemplates
      }
    },
    { immediate: true },
  )

  const emailRecordDisplayValue = computed(() =>
    getCommunicationRecordLabel(
      form.value,
      props.templates,
      recordEmailActions.value.map((action) => action.templateName),
      communicationReferenceTemplates.value,
    ),
  )
  const phoneRecordDisplayValue = computed(() =>
    getCommunicationRecordLabel(
      form.value,
      props.templates,
      recordPhoneTemplate.value ? [recordPhoneTemplate.value.name] : [],
      communicationReferenceTemplates.value,
    ),
  )
  const emailsTabLabel = computed(() => t('navigationGroup.mails'))
  const supplementalDisabledReason = computed(() =>
    hasPersistedItem.value ? '' : t('global.recordContentAvailableAfterSave'),
  )
  const supplementalTabs = computed(() => {
    const tabs = []
    if (canShowInformationTab.value) {
      tabs.push({
        value: informationTabIndex.value,
        label: t('navigation.information'),
        icon: 'mdi-text-box-edit-outline',
        disabled: !hasPersistedItem.value,
        disabledReason: supplementalDisabledReason.value,
        dirty: informationDirty.value,
      })
    }
    if (canShowDocumentsTab.value) {
      tabs.push({
        value: documentsTabIndex.value,
        label: t('navigation.document'),
        icon: 'mdi-file-document-multiple-outline',
        disabled: !hasPersistedItem.value,
        disabledReason: supplementalDisabledReason.value,
      })
    }
    if (canShowEmailsTab.value && recordEmailActions.value.length > 0) {
      tabs.push({
        value: emailsTabIndex.value,
        label: emailsTabLabel.value,
        icon: 'mdi-email-multiple-outline',
        disabled: !hasPersistedItem.value,
        disabledReason: supplementalDisabledReason.value,
      })
    }
    if (canShowPhoneCallsTab.value && recordPhoneNumber.value) {
      tabs.push({
        value: phoneCallsTabIndex.value,
        label: t('navigation.phoneCall'),
        icon: 'mdi-phone-log-outline',
        disabled: !hasPersistedItem.value,
        disabledReason: supplementalDisabledReason.value,
      })
    }
    return tabs
  })
  const hasOpenedInformationTab = ref(false)
  const hasOpenedDocumentsTab = ref(false)
  const hasOpenedEmailsTab = ref(false)
  const hasOpenedPhoneCallsTab = ref(false)

  watch(
    [activeTab, supplementalTabs],
    ([tab, tabs]) => {
      if (
        typeof tab === 'number' &&
        tab > relationTemplates.value.length &&
        !tabs.some((supplementalTab) => supplementalTab.value === tab)
      ) {
        activeTab.value = 0
        return
      }
      if (tab === informationTabIndex.value) hasOpenedInformationTab.value = true
      if (tab === documentsTabIndex.value) hasOpenedDocumentsTab.value = true
      if (tab === emailsTabIndex.value) hasOpenedEmailsTab.value = true
      if (tab === phoneCallsTabIndex.value) hasOpenedPhoneCallsTab.value = true
    },
    { immediate: true },
  )

  return {
    itemHandle,
    informationTabIndex,
    documentsTabIndex,
    emailsTabIndex,
    phoneCallsTabIndex,
    hasPersistedItem,
    canShowInformationTab,
    canShowDocumentsTab,
    canShowEmailsTab,
    canShowPhoneCallsTab,
    canUploadDocuments,
    canComposeEmails,
    canCreatePhoneCalls,
    recordPhoneNumber,
    recordEmailActions,
    emailRecordDisplayValue,
    phoneRecordDisplayValue,
    supplementalTabs,
    hasOpenedInformationTab,
    hasOpenedDocumentsTab,
    hasOpenedEmailsTab,
    hasOpenedPhoneCallsTab,
  }
}
