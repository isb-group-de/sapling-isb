import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { useTranslationLoaderMock } = vi.hoisted(() => ({
  useTranslationLoaderMock: vi.fn(() => ({ isLoading: { value: false } })),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: useTranslationLoaderMock,
}))

import SaplingTableFavoriteDialog from '../SaplingTableFavoriteDialog.vue'

describe('SaplingTableFavoriteDialog', () => {
  it('loads the favorite translations used by the title field', () => {
    shallowMount(SaplingTableFavoriteDialog, {
      props: {
        modelValue: true,
        title: '',
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    expect(useTranslationLoaderMock).toHaveBeenCalledWith('favorite')
  })
})
