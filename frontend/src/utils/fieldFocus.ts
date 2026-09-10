const quietFocusTargets = new WeakSet<EventTarget>()

/** Focus a field without triggering its focus-to-open dropdown behavior. */
export function focusFieldQuietly(target: HTMLElement): void {
  quietFocusTargets.add(target)
  try {
    target.focus({ preventScroll: true })
  } finally {
    quietFocusTargets.delete(target)
  }
}

export function isQuietFieldFocus(event?: Event): boolean {
  return event?.type === 'focus' && event.target != null && quietFocusTargets.has(event.target)
}
