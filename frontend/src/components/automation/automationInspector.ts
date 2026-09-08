import { reactive } from 'vue'

export const automationInspector = reactive({
  visible: false,
  entity: '',
  handle: null as string | null,
})
export function openAutomationInspector(entity: string, handle?: string | number | null): void {
  if (!entity) return
  automationInspector.entity = entity
  automationInspector.handle = handle == null ? null : String(handle)
  automationInspector.visible = true
}
