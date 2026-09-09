import 'reflect-metadata';
import type { SaplingNumericMetadata } from './entity-metadata.types';

const SAPLING_NUMERIC_METADATA_KEY = 'sapling:numeric';

export function SaplingNumeric(metadata: SaplingNumericMetadata) {
  if (!Number.isFinite(metadata.step) || metadata.step <= 0) {
    throw new Error('SaplingNumeric step must be a finite positive number.');
  }
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(
      SAPLING_NUMERIC_METADATA_KEY,
      { step: metadata.step },
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
