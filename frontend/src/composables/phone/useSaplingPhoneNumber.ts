import { computed } from 'vue'
import type { CountryItem } from '@/entity/entity'
import {
  SAPLING_DEFAULT_PHONE_COUNTRY,
  SAPLING_DEFAULT_PHONE_DIALING_CODE,
} from '@/constants/project.constants'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { formatSaplingPhoneNumber } from '@/utils/saplingPhoneUtil'

function getCountryHandle(country?: CountryItem | string | null): string | null {
  if (!country) {
    return null
  }

  return typeof country === 'string' ? country : country.handle
}

function getCountryDialingCode(country?: CountryItem | string | null): string | null {
  if (!country || typeof country === 'string') {
    return null
  }

  return country.dialingCode ?? null
}

export function useSaplingPhoneNumber() {
  const currentPersonStore = useCurrentPersonStore()

  const currentCountry = computed(() => currentPersonStore.person?.company?.country ?? null)
  const currentCountryHandleFromPerson = computed(() => getCountryHandle(currentCountry.value))
  const currentCountryHandle = computed(
    () => currentCountryHandleFromPerson.value ?? SAPLING_DEFAULT_PHONE_COUNTRY,
  )
  const currentDialingCode = computed(
    () =>
      getCountryDialingCode(currentCountry.value) ??
      (currentCountryHandleFromPerson.value ? null : SAPLING_DEFAULT_PHONE_DIALING_CODE),
  )

  function formatPhoneNumber(value: string | null | undefined): string {
    return formatSaplingPhoneNumber(value, {
      defaultCountry: currentCountryHandle.value,
      defaultDialingCode: currentDialingCode.value,
    })
  }

  return {
    currentCountryHandle,
    currentDialingCode,
    formatPhoneNumber,
  }
}
