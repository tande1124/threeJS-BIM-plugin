import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import InsBimViewer from './components/InsBimViewer/index.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.component('InsBimPlusViewer', InsBimViewer)
app.mount('#app')
