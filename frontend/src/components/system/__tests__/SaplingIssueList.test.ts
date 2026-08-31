import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingIssue } from '@/composables/system/useSaplingIssue'
import SaplingIssueList from '../SaplingIssueList.vue'

const issue: SaplingIssue = {
  id: 42,
  number: 42,
  title: 'A compact issue title',
  html_url: 'https://example.com/issues/42',
  body: [
    '**Type:** Bug',
    '**Reported by:** Ada Lovelace',
    '**Login:** `ada.lovelace`',
    '',
    'Issue **description**',
  ].join('\n'),
  updated_at: '2026-08-31T08:00:00.000Z',
  created_at: '2026-08-31T07:00:00.000Z',
  closed_at: null,
  assignees: [],
  state: 'open',
  labels: [{ name: 'bug', color: 'd73a4a' }],
  comments: [
    {
      id: 7,
      html_url: 'https://example.com/issues/42#comment-7',
      body: 'Comment body',
      created_at: '2026-08-31T09:00:00.000Z',
      updated_at: '2026-08-31T09:00:00.000Z',
      user: {
        login: 'developer',
        avatar_url: '',
        html_url: 'https://example.com/developer',
      },
    },
  ],
}

const translations: Record<string, string> = {
  'issue.openedByAt': 'Geöffnet von {reporter} am {date}',
  'issue.openedAt': 'Geöffnet am {date}',
  'issue.openDurationPrefix': 'Offen seit',
  'issue.closedDurationPrefix': 'Geschlossen nach',
  'issue.durationDaySingular': 'Tag',
  'issue.durationDayPlural': 'Tage',
  'issue.durationHourSingular': 'Stunde',
  'issue.durationHourPlural': 'Stunden',
  'issue.durationMinuteSingular': 'Minute',
  'issue.durationMinutePlural': 'Minuten',
}

function mountIssueList(overrides: Partial<SaplingIssue> = {}, status: 'open' | 'closed' = 'open') {
  return mount(SaplingIssueList, {
    props: {
      issues: [{ ...issue, ...overrides }],
      isLoading: false,
      titleKey: status === 'open' ? 'issue.openIssues' : 'issue.closedIssues',
      status,
      cardPrefix: status,
    },
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, string | number>) => {
          const translation = translations[key] || key

          return params
            ? Object.entries(params).reduce(
                (value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
                translation,
              )
            : translation
        },
      },
      stubs: {
        VCol: { template: '<div><slot /></div>' },
        VIcon: true,
        VChip: { template: '<span><slot /></span>' },
        VBtn: true,
        VAvatar: { template: '<span><slot /></span>' },
        SaplingSurface: {
          props: ['as'],
          template: '<component :is="as || \'div\'"><slot /></component>',
        },
        SaplingMarkdownContent: {
          props: ['source'],
          template: '<div class="markdown-content">{{ source }}</div>',
        },
      },
    },
  })
}

describe('SaplingIssueList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T09:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows reporter, opening date, and live open duration in the collapsed summary', () => {
    const wrapper = mountIssueList()
    const summary = wrapper.get('.sapling-work-card__summary')
    const summaryText = summary.text().replace(/\s+/g, ' ')

    expect(summaryText).toContain('Geöffnet von Ada Lovelace')
    expect(summaryText).toContain('Offen seit 2 Tage, 2 Stunden, 30 Minuten')

    wrapper.unmount()
  })

  it('uses the closing timestamp for the completed duration', () => {
    const wrapper = mountIssueList(
      {
        state: 'closed',
        closed_at: '2026-08-31T07:45:00.000Z',
      },
      'closed',
    )

    const duration = wrapper.get('.sapling-work-card__duration').text().replace(/\s+/g, ' ')

    expect(duration).toContain('Geschlossen nach 45 Minuten')
    expect(duration).not.toContain('Tag')
    expect(duration).not.toContain('Stunde')

    wrapper.unmount()
  })

  it('keeps issue details and comments collapsed independently', async () => {
    const wrapper = mountIssueList()
    const issueToggle = wrapper.get('.sapling-work-card__summary')

    expect(issueToggle.attributes('aria-expanded')).toBe('false')
    expect(issueToggle.text()).toContain('issue.typeBug')
    expect(issueToggle.text()).toContain('issue.open')
    expect(wrapper.text()).not.toContain('Issue **description**')

    await issueToggle.trigger('click')

    expect(issueToggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('Issue **description**')
    expect(wrapper.findAll('.sapling-work-card__timestamp')).toHaveLength(2)

    const commentsToggle = wrapper.get('.sapling-work-card__comments-toggle')
    expect(commentsToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('Comment body')

    await commentsToggle.trigger('click')

    expect(commentsToggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('Comment body')

    await issueToggle.trigger('click')
    await issueToggle.trigger('click')

    expect(wrapper.get('.sapling-work-card__comments-toggle').attributes('aria-expanded')).toBe(
      'false',
    )
    expect(wrapper.text()).not.toContain('Comment body')

    wrapper.unmount()
  })
})
