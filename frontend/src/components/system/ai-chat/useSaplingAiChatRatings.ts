import { ref } from 'vue'
import type { AiChatMessageItem } from '@/entity/entity'
import ApiAiService from '@/services/api.ai.service'

export function useSaplingAiChatRatings(upsertMessage: (message: AiChatMessageItem) => void) {
  const ratingStateByHandle = ref<Record<number, boolean>>({})

  async function updateMessageRating(payload: {
    message: AiChatMessageItem
    rating: -1 | 1 | null
  }) {
    const handle = payload.message.handle
    if (handle == null || handle <= 0 || ratingStateByHandle.value[handle]) return

    ratingStateByHandle.value = { ...ratingStateByHandle.value, [handle]: true }
    try {
      upsertMessage(await ApiAiService.updateMessageRating(handle, { rating: payload.rating }))
    } finally {
      const nextState = { ...ratingStateByHandle.value }
      delete nextState[handle]
      ratingStateByHandle.value = nextState
    }
  }

  return { ratingStateByHandle, updateMessageRating }
}
