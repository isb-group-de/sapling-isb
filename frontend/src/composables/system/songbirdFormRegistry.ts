import { reactive, shallowReactive } from 'vue'
import type {
  SongbirdFormContext,
  SongbirdFormProposal,
  SongbirdFormProposalState,
} from './songbirdForm.types'
export type SongbirdFormTarget = {
  formId: string
  capture: () => SongbirdFormContext | null
  apply: (proposal: SongbirdFormProposal, names: string[]) => Promise<boolean>
  focus: () => void
  isAvailable: () => boolean
}
export const songbirdForms = shallowReactive(new Map<string, SongbirdFormTarget>())
export const songbirdFormProposals = shallowReactive(new Map<string, SongbirdFormProposalState>())
export function captureSongbirdForm(formId?: string): SongbirdFormContext | null {
  const target = formId ? songbirdForms.get(formId) : null
  return target?.isAvailable() ? target.capture() : null
}
export function registerSongbirdFormProposal(
  proposal: SongbirdFormProposal,
): SongbirdFormProposalState {
  const existing = songbirdFormProposals.get(proposal.id)
  if (existing) return existing
  const state = reactive<SongbirdFormProposalState>({
    proposal,
    selected: proposal.fields.map((field) => field.name),
    status: 'pending',
    error: '',
    validationFailed: false,
  })
  songbirdFormProposals.set(proposal.id, state)
  return state
}
export async function applySongbirdFormProposal(state: SongbirdFormProposalState) {
  if (state.status !== 'pending' || !state.selected.length) return
  const target = songbirdForms.get(state.proposal.formId)
  if (!target?.isAvailable()) {
    state.error = 'aiChat.formUnavailable'
    return
  }
  state.status = 'applying'
  state.error = ''
  try {
    state.validationFailed = !(await target.apply(state.proposal, [...state.selected]))
    state.status = 'applied'
    target.focus()
  } catch (error) {
    state.status = 'pending'
    state.error =
      error instanceof Error && error.message.startsWith('aiChat.')
        ? error.message
        : 'aiChat.formApplyFailed'
  }
}
export function resetSongbirdFormProposals() {
  songbirdFormProposals.clear()
}
