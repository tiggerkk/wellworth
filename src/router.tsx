import { createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { RootRedirect } from './components/RootRedirect'
import {
  AddActivitySheet,
  AddFoodSheet,
  ActivityLogSheet,
  DailyReportSheet,
  Dashboard,
  Diary,
  FoodDetailSheet,
  HighlightedNutrientsSheet,
  Home,
  ImportFoodsSheet,
  Library,
  Login,
  NetWorthDashboard,
  NetWorthEntry,
  NewActivitySheet,
  NewFoodSheet,
  Settings,
  VisibleNutrientsSheet,
  WellnessSettings,
} from './screens'

// Routes are flat children of the single <AppShell/> layout (full path strings, no
// nested layout route) so the background-location sheet pattern + single <Outlet/> are
// unchanged. Modules are URL-namespaced (/wellness/*, /networth/*); see constants/routes.ts.
export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          // Home hub + global settings
          { index: true, element: <RootRedirect /> },
          { path: 'home', element: <Home /> },
          { path: 'settings', element: <Settings /> },

          // Wellness module — tabs
          { path: 'wellness', element: <Diary /> },
          { path: 'wellness/dashboard', element: <Dashboard /> },
          { path: 'wellness/library', element: <Library /> },
          { path: 'wellness/settings', element: <WellnessSettings /> },
          // Wellness module — route-based sheets (background-location paints the tab behind)
          { path: 'wellness/add-food', element: <AddFoodSheet /> },
          { path: 'wellness/food/:source/:id', element: <FoodDetailSheet /> },
          { path: 'wellness/add-activity', element: <AddActivitySheet /> },
          { path: 'wellness/activity/:activityId', element: <ActivityLogSheet /> },
          { path: 'wellness/report/:day', element: <DailyReportSheet /> },
          { path: 'wellness/import-foods', element: <ImportFoodsSheet /> },
          { path: 'wellness/new-food', element: <NewFoodSheet /> },
          { path: 'wellness/edit-food/:id', element: <NewFoodSheet /> },
          { path: 'wellness/new-activity', element: <NewActivitySheet /> },
          { path: 'wellness/edit-activity/:id', element: <NewActivitySheet /> },
          {
            path: 'wellness/settings/highlighted',
            element: <HighlightedNutrientsSheet />,
          },
          { path: 'wellness/settings/visible', element: <VisibleNutrientsSheet /> },

          // Net Worth module — placeholders (M3+ fills these in)
          { path: 'networth', element: <NetWorthDashboard /> },
          { path: 'networth/entry', element: <NetWorthEntry /> },
        ],
      },
    ],
  },
])
