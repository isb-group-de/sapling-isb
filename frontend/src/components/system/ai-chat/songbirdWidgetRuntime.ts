import type { AiAgentItem, AiProviderModelItem, AiProviderTypeItem } from '@/entity/entity'
import type { AiWidget } from './songbirdWorkspaceRegistry'
import {
  getModelHandle,
  getProviderHandle,
  getModelProviderHandle,
  resolveRuntimeTarget,
} from './aiChatRuntimeTargets'

export function resolveSongbirdWidgetRuntime(
  config: AiWidget['config'],
  agent: AiAgentItem | null,
  providers: AiProviderTypeItem[],
  models: AiProviderModelItem[],
) {
  return resolveRuntimeTarget({
    providerConfigs: providers,
    modelConfigs: models,
    requestedProviderHandle:
      config.providerHandle ??
      (config.modelHandle ? undefined : getProviderHandle(agent?.provider)),
    requestedModelHandle:
      config.modelHandle ?? (config.providerHandle ? undefined : getModelHandle(agent?.model)),
  })
}

export function isSongbirdWidgetRuntimeAvailable(
  config: AiWidget['config'],
  agents: { value: string }[],
  providers: AiProviderTypeItem[],
  models: AiProviderModelItem[],
): boolean {
  const model = models.find((item) => item.handle === config.modelHandle)
  return (
    (!config.agentHandle || agents.some((item) => item.value === config.agentHandle)) &&
    (!config.providerHandle || providers.some((item) => item.handle === config.providerHandle)) &&
    (!config.modelHandle ||
      (!!model &&
        (!config.providerHandle || getModelProviderHandle(model) === config.providerHandle)))
  )
}
