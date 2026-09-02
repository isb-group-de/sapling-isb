// Import the createApp function from Vue
import { createApp } from 'vue'
// Import the root App component
import App from './App.vue'
// Import the router instance
import router from './router'
// Import the Vuetify plugin
import vuetify from './plugins/vuetify'
// Import the font loader utility
import { loadFonts } from './plugins/webfontloader'
// Import Vuetify styles
import 'vuetify/styles'
// Import the global frontend style framework
import './assets/styles/framework/SaplingFramework.css'
// Import the i18n instance for internationalization
import { i18n } from './i18n'
// Import Pinia for state management
import { createPinia } from 'pinia'
// Import the tilt directive
import { vTilt } from './directives/tilt'
import { vCssVars } from './directives/cssVars'
import { configureApiClient } from './services/api.client'
import { installGlobalModifiedLinkNavigation } from './utils/linkNavigation'
import { installFrontendTelemetry } from './services/frontend.telemetry.service'

// Create a Pinia instance
const pinia = createPinia()

configureApiClient()
installGlobalModifiedLinkNavigation()

// Load custom web fonts
loadFonts()

// Create the Vue application, register plugins, and mount it to the DOM
const app = createApp(App)
  .use(pinia)
  .use(router)
  .use(vuetify)
  .use(i18n)
  .directive('tilt', vTilt)
  .directive('css-vars', vCssVars)
installFrontendTelemetry(app)
app.mount('#app')
