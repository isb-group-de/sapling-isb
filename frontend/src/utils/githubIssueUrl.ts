const GITHUB_ISSUE_PATH = '/issue'

/**
 * Preserves the current in-app location when navigating to the issue composer.
 */
export function getGithubIssueSourcePath(fullPath: string): string | undefined {
  const source = new URL(fullPath, 'https://sapling.local')
  if (source.pathname === GITHUB_ISSUE_PATH) {
    return undefined
  }

  return `${source.pathname}${source.search}${source.hash}`
}

/**
 * Resolves only same-origin Sapling paths so a crafted query parameter cannot
 * publish an unrelated external link as the reported page.
 */
export function resolveGithubIssueSourceUrl(
  sourceValue: unknown,
  origin: string,
): string | undefined {
  const source = Array.isArray(sourceValue) ? sourceValue[0] : sourceValue
  if (typeof source !== 'string' || !source.startsWith('/')) {
    return undefined
  }

  try {
    const base = new URL(origin)
    const resolved = new URL(source, base)
    if (resolved.origin !== base.origin || resolved.pathname === GITHUB_ISSUE_PATH) {
      return undefined
    }

    return resolved.toString()
  } catch {
    return undefined
  }
}

/**
 * Builds GitHub's browser-based issue composer URL from repository metadata.
 */
export function buildGithubNewIssueUrl(repositoryUrl?: string | null): string | undefined {
  if (!repositoryUrl) {
    return undefined
  }

  try {
    const repository = new URL(repositoryUrl)
    if (!['http:', 'https:'].includes(repository.protocol)) {
      return undefined
    }

    repository.pathname = `${repository.pathname.replace(/\/$/, '')}/issues/new`
    repository.search = ''
    repository.hash = ''
    return repository.toString()
  } catch {
    return undefined
  }
}
