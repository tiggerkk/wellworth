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
  settings: '/settings', // global: profile, units, display, account
  settingsVisibleModules: '/settings/visible-modules', // Home-hub module visibility + order (sheet)
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
    entry: '/networth/entry', // Monthly Entry editor
    import: '/networth/import', // manual-asset CSV importer (sheet)
    importFund: '/networth/import-fund', // JPM monthly fund CSV importer (sheet)
    insurancePolicies: '/networth/insurance', // searchable/filterable policy list
    insuranceEntry: '/networth/insurance/new', // blank New Insurance (new)
    insuranceEdit: (id: string) => `/networth/insurance/${id}`, // New/Edit Insurance form
    importInsuranceBulk: '/networth/import-insurance', // one-time bulk seed (sheet)
    fund: (id: string) => `/networth/fund/${id}`, // fund detail (drill-in)
    policy: (id: string) => `/networth/policy/${id}`, // policy detail (drill-in, read-only month)
    settings: '/networth/settings', // net-worth sub-settings: visible asset types, imports
    settingsVisibleAssetTypes: '/networth/settings/asset-types', // visible/order sheet
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
    settings: '/quotes/settings', // quotes sub-settings: field visibility, lists, importer
    settingsVisible: '/quotes/settings/visible',
    settingsSourceTypes: '/quotes/settings/source-types', // manage Source Type list (sheet)
    settingsCategories: '/quotes/settings/categories', // manage Category list (sheet)
    import: '/quotes/import', // CSV importer (sheet)
  },
  medical: {
    base: '/medical',
    dashboard: '/medical', // trends + latest values + reports timeline
    reports: '/medical/reports',
    entry: '/medical/entry', // blank Add Report (new)
    detail: (id: string) => `/medical/${id}`, // read-only Report detail
    edit: (id: string) => `/medical/${id}/edit`, // Add/Edit Report form (editing)
    settings: '/medical/settings', // tracked tests, display order, biometric lock
    settingsVisible: '/medical/settings/visible',
    settingsTracked: '/medical/settings/tracked',
    settingsOrder: '/medical/settings/order', // drag-to-reorder sections + tests
    settingsLock: '/medical/settings/lock', // biometric/PIN lock config
    import: '/medical/import', // structured JSON/CSV importer (sheet)
  },
  travel: {
    base: '/travel',
    dashboard: '/travel', // tiles, province progress, trip shelves
    map: '/travel/map', // Leaflet map of visited cities + region fill
    trips: '/travel/trips', // searchable/filterable trip list
    entry: '/travel/entry', // new Trip Builder
    edit: (id: string) => `/travel/trip/${id}`, // Trip Builder (itinerary + expenses)
    settings: '/travel/settings', // entry-form fields, expense categories, imports
    settingsVisible: '/travel/settings/visible', // Trip-form field visibility (sheet)
    settingsCategories: '/travel/settings/categories', // manage expense-category list (sheet)
    importExpenses: '/travel/import-expenses', // wide CSV expenses importer (sheet)
    importTrips: '/travel/import-trips', // itinerary JSON-array importer (sheet)
  },
} as const
