import { ref } from 'vue'

export function useSaplingPlaygroundFields() {
  const booleanFieldValue = ref(true)
  const colorFieldValue = ref('#000000')
  const shortTextFieldValue = ref('')
  const longTextFieldValue = ref('')
  const numberFieldValue = ref<number | null>(null)
  const moneyFieldValue = ref<number | null>(null)
  const percentFieldValue = ref<number | null>(null)
  const dateTypeFieldValue = ref<string | null>(null)
  const timeFieldValue = ref<string | null>(null)
  const dateTimeDateValue = ref('')
  const dateTimeTimeValue = ref('')
  const markdownFieldValue = ref('')
  const iconFieldItems = [
    { name: 'mdi-home' },
    { name: 'mdi-account' },
    { name: 'mdi-email' },
    { name: 'mdi-phone' },
    { name: 'mdi-link-variant' },
  ]
  const iconFieldValue = ref('mdi-home')

  return {
    booleanFieldValue,
    colorFieldValue,
    shortTextFieldValue,
    longTextFieldValue,
    numberFieldValue,
    moneyFieldValue,
    percentFieldValue,
    dateTypeFieldValue,
    timeFieldValue,
    dateTimeDateValue,
    dateTimeTimeValue,
    markdownFieldValue,
    iconFieldItems,
    iconFieldValue,
  }
}
