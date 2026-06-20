/**
 * Central source of truth for app route paths. Modules are URL-namespaced
 * (`/wellness/*`, `/networth/*`) so adding a module is a drop-in: add its paths
 * here + a `ModuleDef` in `modules.ts`.
 *
 * These are **path builders only** — URL-as-state query strings (`?day=`,
 * `?group=`, `?entry=`, `?tab=`) are appended by callers.
 */
export const routes = {
  root: '/',
  login: '/login',
  home: '/home',
  settings: '/settings', // global: profile, units, account
  wellness: {
    base: '/wellness',
    diary: '/wellness',
    dashboard: '/wellness/dashboard',
    library: '/wellness/library',
    settings: '/wellness/settings', // wellness sub-settings: targets, display
    settingsHighlighted: '/wellness/settings/highlighted',
    settingsVisible: '/wellness/settings/visible',
    addFood: '/wellness/add-food',
    food: (source: string, id: string) => `/wellness/food/${source}/${id}`,
    addActivity: '/wellness/add-activity',
    activity: (id: string) => `/wellness/activity/${id}`,
    report: (day: string) => `/wellness/report/${day}`,
    importFoods: '/wellness/import-foods',
    newFood: '/wellness/new-food',
    editFood: (id: string) => `/wellness/edit-food/${id}`,
    newActivity: '/wellness/new-activity',
    editActivity: (id: string) => `/wellness/edit-activity/${id}`,
  },
  networth: {
    base: '/networth',
    dashboard: '/networth',
    entry: '/networth/entry',
    import: '/networth/import',
  },
  shows: {
    base: '/shows',
    dashboard: '/shows',
    library: '/shows/library',
    entry: '/shows/entry', // blank Entry (new)
    edit: (id: string) => `/shows/${id}`,
    settings: '/shows/settings', // shows sub-settings: field visibility, importer
    settingsVisible: '/shows/settings/visible',
    import: '/shows/import', // CSV importer (sheet)
  },
  books: {
    base: '/books',
    dashboard: '/books',
    library: '/books/library',
    entry: '/books/entry', // blank Entry (new)
    edit: (id: string) => `/books/${id}`,
    settings: '/books/settings', // books sub-settings: field visibility, importer
    settingsVisible: '/books/settings/visible',
    import: '/books/import', // CSV importer (sheet)
  },
  quotes: {
    base: '/quotes',
    zen: '/quotes', // Moment of Zen (module index)
    library: '/quotes/library',
    entry: '/quotes/entry', // blank Entry (new)
    edit: (id: string) => `/quotes/${id}`,
    settings: '/quotes/settings', // quotes sub-settings: field visibility, importer
    settingsVisible: '/quotes/settings/visible',
    import: '/quotes/import', // CSV importer (sheet)
  },
} as const
