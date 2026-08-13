export const SAPLING_START_DASHBOARD_TUTORIAL_EVENT = 'sapling:start-dashboard-tutorial'
export const SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT = 'sapling:set-dashboard-tutorial-layout'

export function startSaplingDashboardTutorial() {
  window.dispatchEvent(new CustomEvent(SAPLING_START_DASHBOARD_TUTORIAL_EVENT))
}

export function setSaplingDashboardTutorialLayout(editing: boolean) {
  window.dispatchEvent(
    new CustomEvent<boolean>(SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT, {
      detail: editing,
    }),
  )
}
