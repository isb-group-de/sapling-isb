import { ref } from 'vue'
import ApiGenericService from '@/services/api.generic.service'
import {
  saveMailSignatureSettings,
  loadMailSignatureSettings,
  type EmailSignature,
} from '@/services/api.mail-signature.service'

export function useMailSignatures() {
  const signatures = ref<EmailSignature[]>([])
  const signatureRotation = ref(true)
  const signatureHandle = ref<number | null>(null)
  const resolvedSignatureHandle = ref<number | null>(null)
  const signaturesReady = ref(false)
  const isSavingSignatureDefaults = ref(false)
  let sequence = 0

  function resetSignatures() {
    sequence++
    signatures.value = []
    signatureRotation.value = true
    signatureHandle.value = null
    resolvedSignatureHandle.value = null
    signaturesReady.value = false
  }

  async function loadSignatures(canRead: boolean) {
    const current = ++sequence
    const [settings, items] = await Promise.all([
      loadMailSignatureSettings(),
      canRead
        ? ApiGenericService.findAll<EmailSignature>('emailSignature', {
            filter: { isActive: true },
            orderBy: { name: 'ASC' },
          })
        : Promise.resolve([]),
    ])
    if (current !== sequence) return
    signatures.value = items
    signatureRotation.value = settings.signatureRotation
    signatureHandle.value = settings.defaultSignatureHandle
    signaturesReady.value = true
  }

  async function saveSignatureDefaults() {
    if (isSavingSignatureDefaults.value || !signaturesReady.value) return
    isSavingSignatureDefaults.value = true
    try {
      await saveMailSignatureSettings({
        signatureRotation: signatureRotation.value,
        defaultSignatureHandle: signatureHandle.value,
      })
    } finally {
      isSavingSignatureDefaults.value = false
    }
  }

  function signaturePayload() {
    return {
      signatureMode: signatureRotation.value
        ? ('rotation' as const)
        : signatureHandle.value
          ? ('fixed' as const)
          : ('none' as const),
      signatureHandle:
        (signatureRotation.value ? resolvedSignatureHandle.value : signatureHandle.value) ??
        undefined,
    }
  }

  return {
    signatures,
    signatureRotation,
    signatureHandle,
    resolvedSignatureHandle,
    isSavingSignatureDefaults,
    saveSignatureDefaults,
    signaturesReady,
    loadSignatures,
    resetSignatures,
    signaturePayload,
  }
}
