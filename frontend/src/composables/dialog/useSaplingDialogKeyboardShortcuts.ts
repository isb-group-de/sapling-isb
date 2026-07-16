export interface SaplingDialogKeyboardShortcutActions {
  cancel: () => void
  save: () => void | Promise<unknown>
  saveAndClose: () => void | Promise<unknown>
}

export function useSaplingDialogKeyboardShortcuts(actions: SaplingDialogKeyboardShortcutActions) {
  function onDialogKeydown(event: KeyboardEvent): void {
    const isModifierPressed = event.ctrlKey || event.metaKey
    if (event.repeat) {
      return
    }

    if (isModifierPressed && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void actions.save()
      return
    }

    if (isModifierPressed && !event.altKey && event.key === 'Enter') {
      event.preventDefault()
      void actions.saveAndClose()
      return
    }

    if (event.key === 'Escape' && !isModifierPressed && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      actions.cancel()
    }
  }

  return { onDialogKeydown }
}
