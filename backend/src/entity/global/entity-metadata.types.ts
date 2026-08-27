export type SaplingOption =
  | 'isCompany'
  | 'isPerson'
  | 'isEntity'
  | 'isSecurity'
  | 'isSearchExcluded'
  | 'isValue'
  | 'isHideAsReference'
  | 'isColor'
  | 'isIcon'
  | 'isChip'
  | 'isReadOnly'
  | 'isRecommended'
  | 'isLink'
  | 'isMail'
  | 'isPhone'
  | 'isOrderASC'
  | 'isOrderDESC'
  | 'isNavigation'
  | 'isMarkdown'
  | 'isSystem'
  | 'isPercent'
  | 'isMoney'
  | 'isNumeric'
  | 'isDuplicateCheck'
  | 'isPartner'
  | 'isToday'
  | 'isDeadline'
  | 'isCurrentPerson'
  | 'isCurrentCompany'
  | 'isCustomer'
  | 'isAutoKey'
  | 'isDateStart'
  | 'isDateEnd';

export interface SaplingReferenceDependency {
  parentField: string;
  targetField: string;
  requireParent?: boolean;
  clearOnParentChange?: boolean;
}

export type SaplingFormWidthSpan = 1 | 2 | 3 | 4;

export interface SaplingFormLayoutMetadata {
  group: string | null;
  groupOrder: number | null;
  order: number | null;
  width: SaplingFormWidthSpan | null;
  formVisible: boolean | null;
  tableOrder: number | null;
  tableVisible: boolean | null;
  mobileOrder: number | null;
  mobileVisible: boolean | null;
}

export interface SaplingFormOptions {
  group?: string | null;
  groupOrder?: number | null;
  order?: number | null;
  width?: SaplingFormWidthSpan | null;
  visible?: boolean | null;
  formVisible?: boolean | null;
  tableOrder?: number | null;
  tableVisible?: boolean | null;
  mobileOrder?: number | null;
  mobileVisible?: boolean | null;
}

export interface SaplingGenericReferenceMetadata {
  entityField: string;
  handleField: string;
}

export interface SaplingReferenceTemplateMapping {
  sourceField: string;
  targetField: string;
  overwrite?: boolean;
}

export interface SaplingReferenceTemplateMetadata {
  mappings: SaplingReferenceTemplateMapping[];
}

export type SaplingInlineCollectionRenderer = 'conditionBuilder';

export interface SaplingInlineCollectionMetadata {
  renderer: SaplingInlineCollectionRenderer;
  sourceEntityField?: string;
}

export interface SaplingKanbanMetadata {
  columnField: string;
  scopeOpenField?: string;
  scopeOpenValue?: boolean;
  recordScopeOpenField?: string;
  recordScopeOpenValue?: boolean;
  cardSubtitleFields?: string[];
  cardMetaFields?: string[];
  cardFooterFields?: string[];
  columnDescriptionField?: string;
}
