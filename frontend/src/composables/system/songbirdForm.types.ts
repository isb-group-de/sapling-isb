export type SongbirdFormField = {
  name: string
  label: string
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'time'
    | 'reference'
    | 'json'
    | 'multiSelect'
  nullable: boolean
  referenceEntity?: string
  choices?: string[]
  integer?: boolean
}
export type SongbirdFormContext = {
  formId: string
  snapshotId: string
  entityHandle: string
  recordHandle: string | null
  mode: 'create' | 'edit'
  fields: SongbirdFormField[]
}
export type SongbirdFormProposal = {
  id: string
  formId: string
  snapshotId: string
  entityHandle: string
  recordHandle: string | null
  fields: { name: string; label: string; value: unknown }[]
}
export type SongbirdFormProposalState = {
  proposal: SongbirdFormProposal
  selected: string[]
  status: 'pending' | 'applying' | 'applied' | 'rejected'
  error: string
  validationFailed: boolean
}
