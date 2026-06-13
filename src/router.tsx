import { createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { Dashboard, Diary, Library, Login, Settings } from './screens'

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
        ],
      },
    ],
  },
])
