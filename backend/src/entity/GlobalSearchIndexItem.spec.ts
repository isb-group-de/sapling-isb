import {
  GLOBAL_SEARCH_INDEX_ENTITY_HANDLE,
  GlobalSearchIndexItem,
} from './GlobalSearchIndexItem';
import {
  getSaplingFormLayout,
  hasSaplingOption,
} from './global/entity.decorator';
import { ENTITY_MAP } from './global/entity.registry';

describe('GlobalSearchIndexItem', () => {
  it('is registered with a visible read-only table schema', () => {
    expect(ENTITY_MAP[GLOBAL_SEARCH_INDEX_ENTITY_HANDLE]).toBe(
      GlobalSearchIndexItem,
    );

    for (const property of [
      'handle',
      'entityHandle',
      'recordHandle',
      'fieldPath',
      'fieldValue',
      'sourceUpdatedAt',
    ]) {
      expect(
        getSaplingFormLayout(GlobalSearchIndexItem.prototype, property)
          .tableVisible,
      ).toBe(true);
      expect(
        hasSaplingOption(
          GlobalSearchIndexItem.prototype,
          property,
          'isReadOnly',
        ),
      ).toBe(true);
    }
  });
});
