import axios from 'axios'
import { buildApiUrl } from './api.client'
import { pushApiErrorMessage } from './api.error.service'

export type EmailSignature = {
  handle: number
  name: string
  bodyMarkdown: string
  isActive: boolean
  useInRotation: boolean
}

export type MailSignatureSettings = {
  signatureRotation: boolean
  defaultSignatureHandle: number | null
}

export async function loadMailSignatureSettings(): Promise<MailSignatureSettings> {
  try {
    return (await axios.get<MailSignatureSettings>(buildApiUrl('mail/signature-settings'))).data
  } catch (error) {
    pushApiErrorMessage(error, 'exception.unknownError', 'mail')
    throw error
  }
}

export async function saveMailSignatureSettings(settings: MailSignatureSettings) {
  try {
    return (
      await axios.patch<MailSignatureSettings>(buildApiUrl('mail/signature-settings'), settings)
    ).data
  } catch (error) {
    pushApiErrorMessage(error, 'exception.unknownError', 'mail')
    throw error
  }
}
