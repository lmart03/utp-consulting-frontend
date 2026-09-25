import { Routes } from '@angular/router';

import { DashboardPage } from './pages/dashboard-page/dashboard-page';
import { DashboardStore } from './stores/dashboard.store';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardPage,
    title: 'Panel de automatización · UTP Assistant',
    // Store a nivel de ruta: el estado y la conexión WebSocket viven mientras se está en el dashboard.
    providers: [DashboardStore],
  },
];
