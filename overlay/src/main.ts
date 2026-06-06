import { createApp } from 'vue'
import App from './App.vue'
import './assets/theme.css'
import './assets/overlay.css'
import { applyThemeFromQuery } from './theme'

applyThemeFromQuery()
createApp(App).mount('#app')
