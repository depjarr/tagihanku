import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import HomeView from '../views/HomeView.vue'
import BillEditorView from '../views/BillEditorView.vue'
import SummaryView from '../views/SummaryView.vue'
import SharedView from '../views/SharedView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import SettingsView from '../views/SettingsView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import AppearanceView from '../views/settings/AppearanceView.vue'
import ClaimBillsView from '../views/settings/ClaimBillsView.vue'
import NotificationSettingsView from '../views/settings/NotificationSettingsView.vue'
import PasswordView from '../views/settings/PasswordView.vue'
import PaymentMethodsSettingsView from '../views/settings/PaymentMethodsSettingsView.vue'
import ProfileView from '../views/settings/ProfileView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/new', name: 'new', component: BillEditorView },
    { path: '/bills/:id/edit', name: 'edit', component: BillEditorView },
    { path: '/bills/:id/summary', name: 'summary', component: SummaryView },
    { path: '/s/:code', name: 'shared', component: SharedView },

    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
    { path: '/forgot-password', name: 'forgot', component: ForgotPasswordView, meta: { guestOnly: true } },
    { path: '/reset-password', name: 'reset', component: ResetPasswordView },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true } },
    { path: '/notifications', name: 'notifications', component: NotificationsView, meta: { requiresAuth: true } },
    { path: '/settings/appearance', name: 'settings-appearance', component: AppearanceView }, // tamu juga boleh ganti tampilan
    { path: '/settings/notifications', name: 'settings-notifications', component: NotificationSettingsView, meta: { requiresAuth: true } },
    { path: '/settings/payment-methods', name: 'settings-payments', component: PaymentMethodsSettingsView, meta: { requiresAuth: true } },
    { path: '/settings/password', name: 'settings-password', component: PasswordView, meta: { requiresAuth: true } },
    { path: '/settings/profile', name: 'settings-profile', component: ProfileView, meta: { requiresAuth: true } },
    { path: '/settings/claim', name: 'settings-claim', component: ClaimBillsView, meta: { requiresAuth: true } },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.loggedIn) return { name: 'login', query: { next: to.fullPath } }
  if (to.meta.guestOnly && auth.loggedIn) return { name: 'home' }
})

export default router
