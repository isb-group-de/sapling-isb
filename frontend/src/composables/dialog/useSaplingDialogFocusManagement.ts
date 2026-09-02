import { nextTick, ref, watch, type Ref } from 'vue'
import type { DialogState } from '@/entity/structure'
import type { SaplingDialogValidationFeedback } from './saplingDialogEdit.types'

interface DialogFocusProps {
  modelValue: boolean
  mode: DialogState
}

interface DialogFocusOptions {
  activeTab: Ref<number>
  expandedGroupIds: Ref<string[]>
  isLoading: Ref<boolean>
  syncExpandedGroups: (forceOpenAll?: boolean) => void
  validationFeedback: Ref<SaplingDialogValidationFeedback | null>
}

export function useSaplingDialogFocusManagement(
  props: DialogFocusProps,
  {
    activeTab,
    expandedGroupIds,
    isLoading,
    syncExpandedGroups,
    validationFeedback,
  }: DialogFocusOptions,
) {
  const formSurfaceRef = ref<HTMLElement | null>(null)
  const hasFocusedCurrentOpenDialog = ref(false)

  function findFirstInvalidFieldShell(): HTMLElement | null {
    const invalidControl = formSurfaceRef.value?.querySelector<HTMLElement>(
      '[aria-invalid="true"], .v-input--error',
    )
    return (
      invalidControl?.closest<HTMLElement>('[data-dialog-field-name]') ?? invalidControl ?? null
    )
  }

  function focusInvalidField(fieldShell: HTMLElement): void {
    const focusableSelector =
      'input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled]), [role="combobox"], [contenteditable="true"]'
    const validationFocusContainer = fieldShell.querySelector<HTMLElement>(
      '[data-dialog-validation-focus]',
    )
    const validationFocusTarget = validationFocusContainer?.matches(focusableSelector)
      ? validationFocusContainer
      : validationFocusContainer?.querySelector<HTMLElement>(focusableSelector)
    const focusTarget = fieldShell.matches(focusableSelector)
      ? fieldShell
      : (validationFocusTarget ??
        fieldShell.querySelector<HTMLElement>(
          `[aria-invalid="true"]:not([disabled]):not([readonly]), ${focusableSelector}`,
        ))
    focusTarget?.focus({ preventScroll: true })
  }

  async function waitForValidationLayout(): Promise<void> {
    await nextTick()
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    })
  }

  async function revealFirstInvalidField(): Promise<void> {
    activeTab.value = 0
    await nextTick()
    const initialFieldShell = findFirstInvalidFieldShell()
    if (!initialFieldShell) return

    const groupId =
      initialFieldShell.closest<HTMLElement>('[data-dialog-group-id]')?.dataset.dialogGroupId
    if (groupId && !expandedGroupIds.value.includes(groupId)) {
      expandedGroupIds.value = [...expandedGroupIds.value, groupId]
    }

    await waitForValidationLayout()
    const fieldShell = findFirstInvalidFieldShell()
    if (!fieldShell) return
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    fieldShell.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    })
    focusInvalidField(fieldShell)
  }

  async function focusFirstField(): Promise<void> {
    if (props.mode === 'readonly' || hasFocusedCurrentOpenDialog.value) return
    hasFocusedCurrentOpenDialog.value = true
    await nextTick()
    const surface = formSurfaceRef.value
    if (!surface) return

    const candidates = surface.querySelectorAll<HTMLElement>(
      'input:not([type=hidden]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])',
    )
    for (const candidate of Array.from(candidates)) {
      if (candidate.offsetParent === null || candidate.getAttribute('aria-hidden') === 'true')
        continue
      candidate.focus({ preventScroll: true })
      if (candidate instanceof HTMLInputElement && candidate.type === 'text') candidate.select?.()
      return
    }
  }

  watch(validationFeedback, (feedback) => {
    if (feedback) void revealFirstInvalidField()
  })
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) syncExpandedGroups(true)
    },
  )
  watch(
    () => [props.modelValue, isLoading.value, props.mode] as const,
    ([isOpen, loading]) => {
      if (!isOpen) {
        hasFocusedCurrentOpenDialog.value = false
        return
      }
      if (!loading) void focusFirstField()
    },
  )

  return { formSurfaceRef }
}
