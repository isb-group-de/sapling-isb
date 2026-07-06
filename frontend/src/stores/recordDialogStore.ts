import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRecordDialogStore = defineStore('recordDialog', () => {
  const dialog = ref(false)
  const entityHandle = ref('')
  const recordHandle = ref<string | number | null>(null)

  function openRecord(nextEntityHandle: string, nextRecordHandle: string | number) {
    if (!nextEntityHandle || nextRecordHandle == null || nextRecordHandle === '') {
      return
    }

    entityHandle.value = nextEntityHandle
    recordHandle.value = nextRecordHandle
    dialog.value = true
  }

  function closeRecord() {
    dialog.value = false
  }

  return {
    dialog,
    entityHandle,
    recordHandle,
    openRecord,
    closeRecord,
  }
})
