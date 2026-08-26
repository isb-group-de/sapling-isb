import { computed, markRaw, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingActionAccount from '@/components/actions/SaplingActionAccount.vue'
import SaplingActionChangePassword from '@/components/actions/SaplingActionChangePassword.vue'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import SaplingActionDelete from '@/components/actions/SaplingActionDelete.vue'
import SaplingActionLogin from '@/components/actions/SaplingActionLogin.vue'
import SaplingActionMail from '@/components/actions/SaplingActionMail.vue'
import SaplingActionSave from '@/components/actions/SaplingActionSave.vue'
import SaplingActionUpload from '@/components/actions/SaplingActionUpload.vue'
import type {
  PlaygroundActionCard,
  PlaygroundDialogLauncher,
  PlaygroundMessageType,
} from '@/components/developer/playground.types'
import {
  createPlaygroundMetrics,
  getAvailablePlaygroundKpis,
} from '@/components/developer/playground.utils'
import type { KPIItem, SaplingGenericItem } from '@/entity/entity'
import type { DialogSaveAction, DialogSaveContext, DialogState } from '@/entity/structure'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingPhoneDialog } from '@/composables/dialog/useSaplingPhoneDialog'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

type PlaygroundShowcaseOptions = {
  entityHandle: Readonly<Ref<string>>
  templateCount: Readonly<Ref<number>>
  hasEditContext: Readonly<Ref<boolean>>
  kpis: Array<Ref<KPIItem | null>>
  phone: Ref<string>
  mail: Ref<string>
  link: Ref<string>
}

export function useSaplingPlaygroundShowcase(options: PlaygroundShowcaseOptions) {
  const { t } = useI18n()
  const { openMailDialog } = useSaplingMailDialog()
  const { openPhoneDialog } = useSaplingPhoneDialog()
  const { pushMessage } = useSaplingMessageCenter()

  const deleteDialogModel = ref(false)
  const deleteDialogItem = ref<SaplingGenericItem | null>({
    handle: 101,
    name: t('playground.deleteDialogRecordName'),
  })
  const kpiDialogModel = ref(false)
  const selectedKpi = ref<KPIItem | null>(null)
  const editDialogModel = ref(false)
  const editDialogMode = ref<DialogState>('create')
  const editDialogItem = ref<SaplingGenericItem | null>(null)

  const availableKpiOptions = computed(() =>
    getAvailablePlaygroundKpis(options.kpis.map((kpi) => kpi.value)),
  )
  const canOpenKpiDialog = computed(() => availableKpiOptions.value.length > 0)

  function pushFeedback(message: string, color = 'primary') {
    const type =
      color === 'error' || color === 'warning' || color === 'success' || color === 'info'
        ? color
        : 'info'
    pushMessage(type, message, '', 'playground')
  }

  function simulateMessage(type: PlaygroundMessageType) {
    const messages: Record<PlaygroundMessageType, { message: string; description: string }> = {
      error: {
        message: t('playground.messageCenterErrorTitle'),
        description: t('playground.messageCenterErrorDescription'),
      },
      warning: {
        message: t('playground.messageCenterWarningTitle'),
        description: t('playground.messageCenterWarningDescription'),
      },
      success: {
        message: t('playground.messageCenterSuccessTitle'),
        description: t('playground.messageCenterSuccessDescription'),
      },
      info: {
        message: t('playground.messageCenterInfoTitle'),
        description: t('playground.messageCenterInfoDescription'),
      },
    }
    const config = messages[type]
    pushMessage(type, config.message, config.description, 'playground')
  }

  function openDeleteDialog() {
    deleteDialogModel.value = true
  }

  function handleDeleteConfirm() {
    deleteDialogModel.value = false
    pushFeedback(t('playground.deleteConfirmedFeedback'), 'warning')
  }

  function handleDeleteCancel() {
    deleteDialogModel.value = false
    pushFeedback(t('playground.deleteClosedFeedback'), 'info')
  }

  function openKpiDialog() {
    if (!canOpenKpiDialog.value) return
    selectedKpi.value ??= availableKpiOptions.value[0] ?? null
    kpiDialogModel.value = true
  }

  function closeKpiDialog() {
    kpiDialogModel.value = false
  }

  function handleKpiAdd() {
    kpiDialogModel.value = false
    pushFeedback(
      t('playground.kpiLinkedFeedback', {
        name: selectedKpi.value?.name ?? t('global.notAvailable'),
      }),
      'success',
    )
  }

  function openEditDialog() {
    if (!options.hasEditContext.value) return
    editDialogMode.value = 'create'
    editDialogItem.value = null
    editDialogModel.value = true
  }

  function handleEditSave(
    _value: SaplingGenericItem,
    action: DialogSaveAction,
    context?: DialogSaveContext,
  ) {
    pushFeedback(t('playground.editExecutedFeedback', { action }), 'success')
    context?.complete()
  }

  function handleEditCancel() {
    pushFeedback(t('playground.editClosedFeedback'), 'info')
  }

  function openMailDialogShowcase() {
    openMailDialog({
      entityHandle: options.entityHandle.value,
      itemHandle: 1,
      initialTo: [options.mail.value || 'demo@sapling.local'],
      initialSubject: t('playground.mailInitialSubject'),
      draftValues: { email: options.mail.value, link: options.link.value },
    })
  }

  function openPhoneDialogShowcase() {
    openPhoneDialog({
      phoneNumber: options.phone.value || '+49 30 1234567',
      entityHandle: options.entityHandle.value,
      itemHandle: 1,
      draftValues: { phone: options.phone.value },
    })
  }

  const actionCards = computed<PlaygroundActionCard[]>(() => [
    {
      key: 'save',
      title: t('playground.actionSaveTitle'),
      description: t('playground.actionSaveDescription'),
      component: markRaw(SaplingActionSave),
      props: {
        cancel: () => pushFeedback(t('playground.actionSaveCancelFeedback'), 'info'),
        save: () => pushFeedback(t('playground.actionSaveFeedback'), 'success'),
        saveAndClose: () => pushFeedback(t('playground.actionSaveAndCloseFeedback'), 'success'),
      },
    },
    {
      key: 'delete',
      title: t('playground.actionDeleteTitle'),
      description: t('playground.actionDeleteDescription'),
      component: markRaw(SaplingActionDelete),
      props: {
        handleCancel: () => pushFeedback(t('playground.actionDeleteCancelFeedback'), 'info'),
        handleConfirm: () => pushFeedback(t('playground.actionDeleteConfirmFeedback'), 'warning'),
      },
    },
    {
      key: 'close',
      title: t('playground.actionCloseTitle'),
      description: t('playground.actionCloseDescription'),
      component: markRaw(SaplingActionClose),
      props: { close: () => pushFeedback(t('playground.actionCloseFeedback'), 'info') },
    },
    {
      key: 'login',
      title: t('playground.actionLoginTitle'),
      description: t('playground.actionLoginDescription'),
      component: markRaw(SaplingActionLogin),
      props: {
        handleAzure: () => pushFeedback(t('playground.actionAzureLoginFeedback'), 'primary'),
        handleGoogle: () => pushFeedback(t('playground.actionGoogleLoginFeedback'), 'primary'),
        handleLogin: () => pushFeedback(t('playground.actionLocalLoginFeedback'), 'success'),
        isLoading: false,
      },
    },
    {
      key: 'mail',
      title: t('playground.actionMailTitle'),
      description: t('playground.actionMailDescription'),
      component: markRaw(SaplingActionMail),
      props: {
        close: () => pushFeedback(t('playground.actionMailCloseFeedback'), 'info'),
        refreshPreview: () => pushFeedback(t('playground.actionMailRefreshFeedback'), 'primary'),
        send: () => pushFeedback(t('playground.actionMailSendFeedback'), 'success'),
        isPreviewLoading: false,
        isSending: false,
      },
    },
    {
      key: 'upload',
      title: t('playground.actionUploadTitle'),
      description: t('playground.actionUploadDescription'),
      component: markRaw(SaplingActionUpload),
      props: { isLoading: false },
      listeners: {
        close: () => pushFeedback(t('playground.actionUploadCloseFeedback'), 'info'),
        upload: () => pushFeedback(t('playground.actionUploadStartFeedback'), 'success'),
      },
    },
    {
      key: 'account',
      title: t('playground.actionAccountTitle'),
      description: t('playground.actionAccountDescription'),
      component: markRaw(SaplingActionAccount),
      props: {
        handleClose: () => pushFeedback(t('playground.actionAccountCloseFeedback'), 'info'),
        handleChangePassword: () =>
          pushFeedback(t('playground.actionAccountPasswordFeedback'), 'primary'),
        handleLogout: () => pushFeedback(t('playground.actionAccountLogoutFeedback'), 'warning'),
      },
    },
    {
      key: 'change-password',
      title: t('playground.actionChangePasswordTitle'),
      description: t('playground.actionChangePasswordDescription'),
      component: markRaw(SaplingActionChangePassword),
      props: {
        allowCancel: true,
        closeDialog: () => pushFeedback(t('playground.actionPasswordCloseFeedback'), 'info'),
        handlePasswordChange: () =>
          pushFeedback(t('playground.actionPasswordConfirmFeedback'), 'success'),
      },
    },
  ])

  const dialogLaunchers = computed<PlaygroundDialogLauncher[]>(() => [
    {
      key: 'delete',
      title: t('playground.deleteDialogTitle'),
      description: t('playground.deleteDialogDescription'),
      icon: 'mdi-delete-outline',
      color: 'error',
      open: openDeleteDialog,
    },
    {
      key: 'kpi',
      title: t('playground.kpiDialogTitle'),
      description: t('playground.kpiDialogDescription'),
      icon: 'mdi-chart-box-outline',
      color: 'primary',
      disabled: !canOpenKpiDialog.value,
      open: openKpiDialog,
    },
    {
      key: 'edit',
      title: t('playground.editDialogTitle'),
      description: t('playground.editDialogDescription'),
      icon: 'mdi-form-select',
      color: 'primary',
      disabled: !options.hasEditContext.value,
      open: openEditDialog,
    },
    {
      key: 'mail',
      title: t('playground.mailDialogTitle'),
      description: t('playground.mailDialogDescription'),
      icon: 'mdi-email-fast-outline',
      color: 'secondary',
      open: openMailDialogShowcase,
    },
    {
      key: 'phone',
      title: t('playground.phoneDialogTitle'),
      description: t('playground.phoneDialogDescription'),
      icon: 'mdi-phone-outline',
      color: 'secondary',
      open: openPhoneDialogShowcase,
    },
  ])

  const metrics = computed(() =>
    createPlaygroundMetrics(
      [
        t('playground.metricActions'),
        t('playground.metricDialogs'),
        t('playground.metricTemplates'),
        t('playground.metricKpiCards'),
      ],
      [actionCards.value.length, dialogLaunchers.value.length, options.templateCount.value, 4],
    ),
  )

  return {
    actionCards,
    dialogLaunchers,
    metrics,
    deleteDialogModel,
    deleteDialogItem,
    kpiDialogModel,
    selectedKpi,
    availableKpiOptions,
    editDialogModel,
    editDialogMode,
    editDialogItem,
    simulateMessage,
    openEditDialog,
    openMailDialogShowcase,
    handleDeleteConfirm,
    handleDeleteCancel,
    closeKpiDialog,
    handleKpiAdd,
    handleEditSave,
    handleEditCancel,
  }
}
