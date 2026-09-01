// Styles
import '@mdi/font/css/materialdesignicons.css'
import { VDateInput } from 'vuetify/components'
import 'vuetify/styles'
import { de, en } from 'vuetify/locale'

// Vuetify
import { createVuetify } from 'vuetify'

// Components and directives are auto-imported on demand by vite-plugin-vuetify
// (see vite.config.ts). VDateInput is registered here for global defaults.
export default createVuetify({
  components: {
    VDateInput,
  },
  defaults: {
    VAutocomplete: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VCard: {
      rounded: 'lg',
    },
    VCombobox: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VDateInput: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VSelect: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VTextarea: {
      density: 'comfortable',
      variant: 'outlined',
    },
    VTextField: {
      density: 'comfortable',
      variant: 'outlined',
    },
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#F3F5F7',
          'on-background': '#1B1E22',
          surface: '#FFFFFF',
          'surface-bright': '#FFFFFF',
          'surface-light': '#F3F5F7',
          'surface-variant': '#D2D6DB',
          'on-surface': '#1B1E22',
          'on-surface-variant': '#333840',
          primary: '#007C83',
          'primary-darken-1': '#006B70',
          'on-primary': '#FFFFFF',
          secondary: '#333840',
          'secondary-darken-1': '#1B1E22',
          'on-secondary': '#FFFFFF',
          info: '#00C1D5',
          'on-info': '#121417',
          success: '#027A39',
          'on-success': '#FFFFFF',
          warning: '#D98E00',
          'on-warning': '#121417',
          error: '#A6192E',
          'on-error': '#FFFFFF',
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#17191D',
          'on-background': '#D2D6DB',
          surface: '#1B1E22',
          'surface-bright': '#333840',
          'surface-light': '#333840',
          'surface-variant': '#333840',
          'on-surface': '#F3F5F7',
          'on-surface-variant': '#D2D6DB',
          primary: '#00C1D5',
          'primary-darken-1': '#008C94',
          'on-primary': '#121417',
          secondary: '#525966',
          'secondary-darken-1': '#333840',
          'on-secondary': '#FFFFFF',
          info: '#00C1D5',
          'on-info': '#121417',
          success: '#43C977',
          'on-success': '#121417',
          warning: '#F0B84B',
          'on-warning': '#121417',
          error: '#E66779',
          'on-error': '#121417',
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi', // set material design icons to default
  },
  locale: {
    locale: 'de', // Standard
    messages: { de, en },
  },
})
