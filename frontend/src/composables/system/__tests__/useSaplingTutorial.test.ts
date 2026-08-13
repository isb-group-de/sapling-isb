import { beforeEach, describe, expect, it } from 'vitest'
import CookieService from '@/services/cookie.service'
import {
  hasSeenTutorial,
  rememberTutorial,
  useSaplingTutorial,
} from '@/composables/system/useSaplingTutorial'

describe('useSaplingTutorial', () => {
  beforeEach(() => {
    CookieService.delete('tutorial-login')
  })

  it('starts an unseen tutorial and remembers completion', () => {
    const tutorial = useSaplingTutorial({ id: 'login', version: 1 })

    expect(tutorial.start()).toBe(true)
    expect(tutorial.isActive.value).toBe(true)

    tutorial.finish()

    expect(tutorial.isActive.value).toBe(false)
    expect(hasSeenTutorial('login', 1)).toBe(true)
  })

  it('does not automatically restart a seen version', () => {
    rememberTutorial('login', 1)
    const tutorial = useSaplingTutorial({ id: 'login', version: 1 })

    expect(tutorial.start()).toBe(false)
    expect(tutorial.isActive.value).toBe(false)
  })

  it('can restart explicitly and treats a new version as unseen', () => {
    rememberTutorial('login', 1)
    const currentTutorial = useSaplingTutorial({ id: 'login', version: 1 })
    const updatedTutorial = useSaplingTutorial({ id: 'login', version: 2 })

    expect(currentTutorial.start({ force: true })).toBe(true)
    expect(updatedTutorial.start()).toBe(true)
  })

  it('sanitizes tutorial IDs before storing them', () => {
    rememberTutorial('Dashboard Tour!', 3)

    expect(CookieService.get('tutorial-dashboard-tour-')).toBe('3')
  })

  it('can stop temporarily without remembering completion', () => {
    const tutorial = useSaplingTutorial({ id: 'login', version: 1 })

    tutorial.start()
    tutorial.stop()

    expect(tutorial.isActive.value).toBe(false)
    expect(hasSeenTutorial('login', 1)).toBe(false)
  })
})
