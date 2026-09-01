import { describe, expect, it } from 'vitest'
import {
  buildGithubNewIssueUrl,
  getGithubIssueSourcePath,
  resolveGithubIssueSourceUrl,
} from '../githubIssueUrl'

describe('githubIssueUrl', () => {
  it('preserves the current Sapling route as an issue source path', () => {
    expect(getGithubIssueSourcePath('/table/ticket?view=open#row-42')).toBe(
      '/table/ticket?view=open#row-42',
    )
    expect(getGithubIssueSourcePath('/issue')).toBeUndefined()
  })

  it('resolves only same-origin Sapling source links', () => {
    expect(resolveGithubIssueSourceUrl('/table/ticket?view=open', 'https://sapling.test')).toBe(
      'https://sapling.test/table/ticket?view=open',
    )
    expect(
      resolveGithubIssueSourceUrl('//attacker.test/phishing', 'https://sapling.test'),
    ).toBeUndefined()
    expect(
      resolveGithubIssueSourceUrl('https://attacker.test', 'https://sapling.test'),
    ).toBeUndefined()
  })

  it('builds the direct GitHub issue composer URL', () => {
    expect(buildGithubNewIssueUrl('https://github.com/owner/repo')).toBe(
      'https://github.com/owner/repo/issues/new',
    )
  })
})
