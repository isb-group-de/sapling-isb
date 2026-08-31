import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { SaplingIssue } from '@/composables/system/useSaplingIssue'
import SaplingIssueList from '../SaplingIssueList.vue'

const issue: SaplingIssue = {
  id: 42,
  number: 42,
  title: 'A compact issue title',
  html_url: 'https://example.com/issues/42',
  body: 'Issue **description**',
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

function mountIssueList() {
  return mount(SaplingIssueList, {
    props: {
      issues: [issue],
      isLoading: false,
      titleKey: 'issue.openIssues',
      status: 'open',
      cardPrefix: 'open',
    },
    global: {
      mocks: {
        $t: (key: string) => key,
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
  })
})
