import 'reflect-metadata';

export interface SaplingReferenceCreateMetadata {
  /** Copy fields from the current draft into the new reference draft. */
  defaults?: Record<string, string>;
}

export interface SaplingRelatedRecordsMetadata {
  /** Paths on the target entity leading back to the current record. */
  paths: string[];
}

export function SaplingReferenceCreate(
  metadata: SaplingReferenceCreateMetadata = {},
) {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(
      'sapling:referenceCreate',
      metadata,
      target,
      propertyKey,
    );
  };
}

export function getSaplingReferenceCreate(
  target: object,
  propertyKey: string | symbol,
): SaplingReferenceCreateMetadata | null {
  return (Reflect.getMetadata('sapling:referenceCreate', target, propertyKey) ??
    null) as SaplingReferenceCreateMetadata | null;
}

export function SaplingRelatedRecords(metadata: SaplingRelatedRecordsMetadata) {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(
      'sapling:relatedRecords',
      metadata,
      target,
      propertyKey,
    );
  };
}

export function getSaplingRelatedRecords(
  target: object,
  propertyKey: string | symbol,
): SaplingRelatedRecordsMetadata | null {
  return (Reflect.getMetadata('sapling:relatedRecords', target, propertyKey) ??
    null) as SaplingRelatedRecordsMetadata | null;
}
