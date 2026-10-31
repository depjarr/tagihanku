import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'
import './style.css'

const pinia = createPinia()
const app = createApp(App).use(pinia)
useAuthStore(pinia).init() // pulihkan sesi + terapkan tema; tidak menahan render
app.use(router).mount('#app')
