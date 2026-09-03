import type { Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import type { SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import type { UseSaplingTableRowEmit, UseSaplingTableRowProps } from './useSaplingTableRow'

const INTERACTIVE_ROW_SELECTOR = [
  'a',
  'button',
  'input',
  'label',
  'select',
  'textarea',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '.v-btn',
  '.v-input',
  '.v-selection-control',
].join(', ')

export function useSaplingTableRowActions(
  props: UseSaplingTableRowProps,
  emit: UseSaplingTableRowEmit,
  menuActive: Ref<boolean>,
) {
  const router = useRouter()
  const { openMailDialog } = useSaplingMailDialog()

  function closeMenu() {
    menuActive.value = false
  }

  function openContextMenu(event: MouseEvent, item: SaplingGenericItem, index: number) {
    if (props.rowInteraction === false) return
    emit('open-context-menu', { item, index, x: event.clientX, y: event.clientY })
  }

  function isInteractiveRowTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(INTERACTIVE_ROW_SELECTOR) !== null
  }

  function onRowMouseDown(event: MouseEvent, index: number) {
    if (props.allowRowDoubleClick === false && event.button === 0 && event.detail > 1) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (props.rowInteraction === false) return
    if (event.button === 0 && !isInteractiveRowTarget(event.target)) {
      emit('activate-row', index)
      if (!props.multiSelect) emit('select-row', index)
    }
  }

  function onRowDoubleClick(event: MouseEvent) {
    if (props.allowRowDoubleClick === false) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (
      props.rowInteraction === false ||
      event.button !== 0 ||
      isInteractiveRowTarget(event.target)
    ) {
      return
    }
    if (props.entityPermission?.allowUpdate) requestEdit(props.item)
    else requestShow(props.item)
  }

  function onRowKeydown(event: KeyboardEvent, index: number) {
    if (props.rowInteraction === false || event.repeat || isInteractiveRowTarget(event.target))
      return

    if (event.key === 'Enter') {
      event.preventDefault()
      if (props.entityPermission?.allowUpdate) requestEdit(props.item)
      else if (props.entityPermission?.allowShow !== false) requestShow(props.item)
      return
    }

    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      emit('select-row', index)
    }
  }

  function toggleRowSelection(index: number) {
    if (props.rowInteraction !== false) emit('select-row', index)
  }

  function requestEdit(item: SaplingGenericItem) {
    closeMenu()
    emit('edit', item)
  }

  function requestChangeLog(item: SaplingGenericItem) {
    closeMenu()
    emit('change-log', item)
  }

  function requestShow(item: SaplingGenericItem) {
    closeMenu()
    emit('show', item)
  }

  function requestDelete(item: SaplingGenericItem) {
    closeMenu()
    emit('delete', item)
  }

  function requestCopy(item: SaplingGenericItem) {
    closeMenu()
    emit('copy', item)
  }

  function requestScript(item: SaplingGenericItem, scriptButton: ScriptButtonItem) {
    closeMenu()
    emit('script', { button: scriptButton, item })
  }

  function requestNavigate(item: SaplingGenericItem) {
    closeMenu()
    emit('navigate', item)
  }

  function requestTimeline(item: SaplingGenericItem) {
    closeMenu()
    emit('timeline', item)
  }

  function requestUploadDocument(item: SaplingGenericItem) {
    closeMenu()
    emit('upload-document', item)
  }

  function requestShowDocuments(item: SaplingGenericItem) {
    closeMenu()
    emit('show-documents', item)
  }

  function requestShowInformation(item: SaplingGenericItem) {
    closeMenu()
    emit('show-information', item)
  }

  function requestShowExternalRecordLinks(item: SaplingGenericItem) {
    closeMenu()
    emit('show-external-record-links', item)
  }

  function requestCustomer360(item: SaplingGenericItem) {
    closeMenu()
    if (item.handle == null || !['company', 'person'].includes(props.entityHandle)) return
    void router.push({
      name: 'customer360',
      params: { entityHandle: props.entityHandle, handle: String(item.handle) },
    })
  }

  function requestMail(item: SaplingGenericItem, email: string) {
    closeMenu()
    if (!email) return
    openMailDialog({
      entityHandle: props.entityHandle,
      itemHandle: item.handle as string | number | undefined,
      draftValues: item,
      initialTo: [email],
    })
  }

  return {
    closeMenu,
    openContextMenu,
    onRowMouseDown,
    onRowDoubleClick,
    onRowKeydown,
    toggleRowSelection,
    requestEdit,
    requestChangeLog,
    requestShow,
    requestDelete,
    requestCopy,
    requestScript,
    requestNavigate,
    requestTimeline,
    requestUploadDocument,
    requestShowDocuments,
    requestShowInformation,
    requestShowExternalRecordLinks,
    requestCustomer360,
    requestMail,
  }
}
