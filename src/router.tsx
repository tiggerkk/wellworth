import { createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { RootRedirect } from './components/RootRedirect'
import {
  AddActivitySheet,
  AddFoodSheet,
  ActivityLogSheet,
  BooksDashboard,
  BooksEntry,
  BooksFieldsSheet,
  BooksLibrary,
  BooksSettings,
  DailyReportSheet,
  Dashboard,
  Diary,
  FoodDetailSheet,
  HighlightedNutrientsSheet,
  Home,
  ImportBooksSheet,
  ImportFoodsSheet,
  ImportNetWorthSheet,
  ImportQuotesSheet,
  Library,
  Login,
  ImportMedicalSheet,
  MedicalDashboard,
  MedicalEntry,
  MedicalFieldsSheet,
  MedicalReportDetail,
  MedicalReports,
  MedicalSettings,
  NetWorthDashboard,
  NetWorthEntry,
  NewActivitySheet,
  NewFoodSheet,
  ImportShowsSheet,
  QuotesEntry,
  QuotesFieldsSheet,
  QuotesLibrary,
  QuotesSettings,
  QuotesZen,
  Settings,
  ShowsDashboard,
  ShowsEntry,
  ShowsFieldsSheet,
  ShowsLibrary,
  ShowsSettings,
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

          // Net Worth module
          { path: 'networth', element: <NetWorthDashboard /> },
          { path: 'networth/entry', element: <NetWorthEntry /> },
          { path: 'networth/import', element: <ImportNetWorthSheet /> },

          // Shows module
          { path: 'shows', element: <ShowsDashboard /> },
          { path: 'shows/library', element: <ShowsLibrary /> },
          { path: 'shows/entry', element: <ShowsEntry /> },
          { path: 'shows/settings', element: <ShowsSettings /> },
          { path: 'shows/settings/visible', element: <ShowsFieldsSheet /> },
          { path: 'shows/import', element: <ImportShowsSheet /> },
          { path: 'shows/:id', element: <ShowsEntry /> },

          // Books module (the importer route lands in M7)
          { path: 'books', element: <BooksDashboard /> },
          { path: 'books/library', element: <BooksLibrary /> },
          { path: 'books/entry', element: <BooksEntry /> },
          { path: 'books/settings', element: <BooksSettings /> },
          { path: 'books/settings/visible', element: <BooksFieldsSheet /> },
          { path: 'books/import', element: <ImportBooksSheet /> },
          { path: 'books/:id', element: <BooksEntry /> },

          // Quotes module (the importer route lands in M7)
          { path: 'quotes', element: <QuotesZen /> },
          { path: 'quotes/library', element: <QuotesLibrary /> },
          { path: 'quotes/entry', element: <QuotesEntry /> },
          { path: 'quotes/settings', element: <QuotesSettings /> },
          { path: 'quotes/settings/visible', element: <QuotesFieldsSheet /> },
          { path: 'quotes/import', element: <ImportQuotesSheet /> },
          { path: 'quotes/:id', element: <QuotesEntry /> },

          // Medical module (Dashboard M4, tracked/reorder/lock M4–M6)
          { path: 'medical', element: <MedicalDashboard /> },
          { path: 'medical/reports', element: <MedicalReports /> },
          { path: 'medical/entry', element: <MedicalEntry /> },
          { path: 'medical/settings', element: <MedicalSettings /> },
          { path: 'medical/settings/visible', element: <MedicalFieldsSheet /> },
          { path: 'medical/import', element: <ImportMedicalSheet /> },
          { path: 'medical/:id', element: <MedicalReportDetail /> },
          { path: 'medical/:id/edit', element: <MedicalEntry /> },
        ],
      },
    ],
  },
])
