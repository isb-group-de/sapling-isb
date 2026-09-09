export type SaplingTableInitialLoadContext = {
  isDefaultWorklistReset: boolean
}

export type InitializeEntityStateOptions = {
  initialSearch?: string
  beforeInitialLoad?: (context?: SaplingTableInitialLoadContext) => Promise<void> | void
}

export type SaplingTableBehaviorOptions = {
  allowGrouping?: boolean
  searchFieldNames?: string[]
  applyDefaultOpenChipFilters?: boolean
}
