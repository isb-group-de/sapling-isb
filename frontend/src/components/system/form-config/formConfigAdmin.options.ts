import type { EntityTemplateFormWidth, SaplingFormRenderer } from '@/entity/structure'
import type { StaticOption } from './formConfigAdmin.types'

export const FORM_CONFIG_WIDTH_OPTIONS: StaticOption<EntityTemplateFormWidth>[] = [
  { title: '25%', value: 1 },
  { title: '50%', value: 2 },
  { title: '75%', value: 3 },
  { title: '100%', value: 4 },
]

export const FORM_CONFIG_RENDERER_OPTIONS: StaticOption<SaplingFormRenderer>[] = [
  { title: 'Auto', value: 'auto' },
  { title: 'Text', value: 'shortText' },
  { title: 'Long text', value: 'longText' },
  { title: 'Number', value: 'number' },
  { title: 'Boolean', value: 'boolean' },
  { title: 'Date', value: 'date' },
  { title: 'Date time', value: 'dateTime' },
  { title: 'Time', value: 'time' },
  { title: 'Markdown', value: 'markdown' },
  { title: 'JSON', value: 'json' },
  { title: 'Phone', value: 'phone' },
  { title: 'Mail', value: 'mail' },
  { title: 'Link', value: 'link' },
  { title: 'Password', value: 'password' },
  { title: 'Money', value: 'money' },
  { title: 'Percent', value: 'percent' },
  { title: 'Color', value: 'color' },
  { title: 'Icon', value: 'icon' },
  { title: 'Select', value: 'select' },
  { title: 'Multi select', value: 'multiSelect' },
]
