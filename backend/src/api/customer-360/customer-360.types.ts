export type Customer360Anchor = 'company' | 'person';

export const CUSTOMER_360_SECTIONS = [
  'contacts',
  'tickets',
  'opportunities',
  'effortEstimates',
  'contracts',
  'documents',
  'relationships',
] as const;

export type Customer360Section = (typeof CUSTOMER_360_SECTIONS)[number];

export type Customer360ActivityKind =
  'emailInbound' | 'emailOutbound' | 'call' | 'appointment' | 'event';

export interface Customer360ActivityItem {
  id: string;
  kind: Customer360ActivityKind;
  direction: 'inbound' | 'outbound' | 'none';
  occurredAt: string;
  entityHandle: string;
  recordHandle: string | number;
  title: string;
  summary?: string | null;
  participants: string[];
  status?: unknown;
  attachmentHandles: number[];
  source?: { entityHandle: string; recordHandle: string | number } | null;
}

export interface Customer360Summary {
  anchor: object;
  anchorEntityHandle: Customer360Anchor;
  companyContext: object | null;
  metrics: {
    lastContactAt: string | null;
    nextAppointmentAt?: string | null;
    openTickets?: number;
    slaCriticalTickets?: number;
    openOpportunities?: number;
    weightedPipeline?: number;
    activeEffortEstimates?: number;
    estimatedHours?: number;
    activeContracts?: number;
    nextContractEndAt?: string | null;
  };
  warnings: Array<{ key: string; severity: string; value?: unknown }>;
  recentActivity: Customer360ActivityItem[];
  availableSections: Customer360Section[];
  actions: {
    mail: boolean;
    call: boolean;
    appointment: boolean;
    ticket: boolean;
    opportunity: boolean;
    effortEstimate: boolean;
    contract: boolean;
  };
}

export interface Customer360ActivityResult {
  items: Customer360ActivityItem[];
  nextBefore: string | null;
  hasMore: boolean;
}

export interface Customer360RelatedResult {
  section: Customer360Section;
  entityHandle: string;
  data: object[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
