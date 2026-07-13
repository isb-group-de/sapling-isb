import { describe, expect, it } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { useSaplingTableChip } from '../useSaplingTableChip'

describe('useSaplingTableChip', () => {
  it('uses relation color as a soft badge style instead of a raw chip foreground', () => {
    const chip = useSaplingTableChip({
      item: {
        segment: {
          handle: 'partner',
          title: 'Partner',
          color: '#37474F',
          icon: 'mdi-handshake-outline',
        },
      } as SaplingGenericItem,
      col: createTemplate({ name: 'segment', type: 'CompanySegmentItem', options: ['isChip'] }),
      referenceTemplates: [
        createTemplate({ name: 'title', type: 'string', options: ['isValue'] }),
        createTemplate({ name: 'color', type: 'string', options: ['isColor'] }),
        createTemplate({ name: 'icon', type: 'string', options: ['isIcon'] }),
      ],
    })

    expect(chip.chipLabel.value).toBe('Partner')
    expect(chip.chipColor.value).toBe('#37474F')
    expect(chip.chipIcon.value).toBe('mdi-handshake-outline')
    expect(chip.chipStyle.value).toMatchObject({
      '--sapling-soft-badge-background': 'rgba(55, 71, 79, 0.24)',
      '--sapling-soft-badge-border': 'rgba(55, 71, 79, 0.46)',
      '--sapling-soft-badge-foreground': 'rgb(139, 148, 153)',
    })
  })

  it('darkens very light relation colors enough for a readable badge foreground', () => {
    const chip = useSaplingTableChip({
      item: {
        segment: {
          handle: 'strategic',
          title: 'Strategischer Kunde',
          color: '#F9A825',
        },
      } as SaplingGenericItem,
      col: createTemplate({ name: 'segment', type: 'CompanySegmentItem', options: ['isChip'] }),
      referenceTemplates: [
        createTemplate({ name: 'title', type: 'string', options: ['isValue'] }),
        createTemplate({ name: 'color', type: 'string', options: ['isColor'] }),
      ],
    })

    expect(chip.chipStyle.value?.['--sapling-soft-badge-foreground']).toBe('rgb(209, 141, 31)')
  })
})

function createTemplate(
  overrides: Partial<EntityTemplate> & Pick<EntityTemplate, 'name' | 'type'>,
): EntityTemplate {
  return {
    name: overrides.name,
    key: overrides.name,
    type: overrides.type,
    options: overrides.options ?? [],
    isPersistent: true,
  } as EntityTemplate
}
