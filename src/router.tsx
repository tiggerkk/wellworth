import { createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import {
  AddActivitySheet,
  AddFoodSheet,
  ActivityLogSheet,
  DailyReportSheet,
  Dashboard,
  Diary,
  FoodDetailSheet,
  Library,
  Login,
  NewActivitySheet,
  NewFoodSheet,
  Settings,
} from './screens'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Diary /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'library', element: <Library /> },
          { path: 'settings', element: <Settings /> },
          // Route-based sheets (background-location keeps the tab painted behind).
          { path: 'add-food', element: <AddFoodSheet /> },
          { path: 'food/:source/:id', element: <FoodDetailSheet /> },
          { path: 'add-activity', element: <AddActivitySheet /> },
          { path: 'activity/:activityId', element: <ActivityLogSheet /> },
          { path: 'report/:day', element: <DailyReportSheet /> },
          { path: 'new-food', element: <NewFoodSheet /> },
          { path: 'edit-food/:id', element: <NewFoodSheet /> },
          { path: 'new-activity', element: <NewActivitySheet /> },
          { path: 'edit-activity/:id', element: <NewActivitySheet /> },
        ],
      },
    ],
  },
])
