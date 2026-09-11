import 'reflect-metadata';
import type { SaplingNumericMetadata } from './entity-metadata.types';

const SAPLING_NUMERIC_METADATA_KEY = 'sapling:numeric';

export function SaplingNumeric(metadata: SaplingNumericMetadata) {
  for (const boundary of ['min', 'max'] as const) {
    const value = metadata[boundary];
    if (value !== undefined && !Number.isFinite(value)) {
      throw new Error(`SaplingNumeric ${boundary} must be a finite number.`);
    }
  }
  if (
    metadata.step !== undefined &&
    (!Number.isFinite(metadata.step) || metadata.step <= 0)
  ) {
    throw new Error('SaplingNumeric step must be a finite positive number.');
  }
  if (
    metadata.min !== undefined &&
    metadata.max !== undefined &&
    metadata.min > metadata.max
  ) {
    throw new Error('SaplingNumeric min must not be greater than max.');
  }
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(
      SAPLING_NUMERIC_METADATA_KEY,
      {
        ...(metadata.min !== undefined ? { min: metadata.min } : {}),
        ...(metadata.max !== undefined ? { max: metadata.max } : {}),
        ...(metadata.step !== undefined ? { step: metadata.step } : {}),
      } satisfies SaplingNumericMetadata,
      target,
      propertyKey,
    );
  };
}

export function getSaplingNumeric(
  target: object,
  propertyKey: string | symbol,
): SaplingNumericMetadata | null {
  return (Reflect.getMetadata(
    SAPLING_NUMERIC_METADATA_KEY,
    target,
    propertyKey,
  ) ?? null) as SaplingNumericMetadata | null;
}
