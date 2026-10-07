import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'BIM',
    component: () => import('@/pages/index.vue'),
  },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
