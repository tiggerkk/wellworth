import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useDiaryVersion, bumpDiary } from '../lib/wellness-diary-refresh'
import { listFoods, deleteFoodSmart, setFavorite } from '../data/food'
import { listActivities, softDeleteActivity } from '../data/activity'
import {
  resolveActivityIcon,
  FOOD_TYPES,
  FOOD_SOURCES,
  ACTIVITY_TEMPLATES,
  EFFORT_LEVELS,
  type FoodSource,
  type FoodType,
} from '../constants/wellness'
import { asNutrientMap, localFoodServing } from '../lib/wellness-nutrients'
import { routes } from '../constants/routes'
import {
  DEFAULT_FOOD_CRITERIA,
  DEFAULT_ACTIVITY_CRITERIA,
  applyFoodListView,
  applyActivityListView,
  type FoodListCriteria,
  type ActivityListCriteria,
} from '../lib/wellness-library'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { ListRow } from '../components/ListRow'
import { FoodRowHeader } from '../components/FoodRowHeader'
import { ActivityRowHeader } from '../components/ActivityRowHeader'
import { ListFab } from '../components/ListFab'
import { EmptyState } from '../components/EmptyState'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'

type Tab = 'foods' | 'activities'

const FOOD_SORT_OPTIONS: { value: FoodListCriteria['sortField']; label: string }[] = [
  { value: 'name', label: 'Food Name' },
  { value: 'type', label: 'Type' },
  { value: 'source', label: 'Source' },
]

const ACTIVITY_SORT_OPTIONS: {
  value: ActivityListCriteria['sortField']
  label: string
}[] = [
  { value: 'name', label: 'Activity Name' },
  { value: 'template', label: 'Template' },
  { value: 'effort', label: 'Effort' },
]

const FOOD_TYPE_OPTIONS = [
  { value: 'all', label: 'Any Type' },
  ...FOOD_TYPES.map((t) => ({ value: t.key, label: t.label })),
]
const FOOD_SOURCE_OPTIONS = [
  { value: 'all', label: 'Any Source' },
  ...FOOD_SOURCES.map((s) => ({ value: s.key, label: s.label })),
]
const ACTIVITY_TEMPLATE_OPTIONS = [
  { value: 'all', label: 'Any Template' },
  ...ACTIVITY_TEMPLATES.map((t) => ({ value: t.key, label: t.label })),
]
const ACTIVITY_EFFORT_OPTIONS = [
  { value: 'all', label: 'Any Effort' },
  ...EFFORT_LEVELS.map((e) => ({ value: e.key, label: e.label })),
]

export function WellnessLibrary() {
  const openSheet = useSheetNavigate()
  const version = useDiaryVersion()
  // Tab lives in the URL so returning from a sheet (New/Edit Food or Activity) restores it
  // instead of resetting to Foods. A clean `/wellness/library` (no param) means Foods.
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'activities' ? 'activities' : 'foods'
  const setTab = useCallback(
    (t: Tab) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'foods') next.delete('tab')
          else next.set('tab', t)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [foodCriteria, setFoodCriteria] = useSessionState<FoodListCriteria>(
    'wellworth:wellness-library-foods',
    DEFAULT_FOOD_CRITERIA,
  )
  const setFoodCrit = (patch: Partial<FoodListCriteria>) =>
    setFoodCriteria((c) => ({ ...c, ...patch }))

  const [activityCriteria, setActivityCriteria] = useSessionState<ActivityListCriteria>(
    'wellworth:wellness-library-activities',
    DEFAULT_ACTIVITY_CRITERIA,
  )
  const setActivityCrit = (patch: Partial<ActivityListCriteria>) =>
    setActivityCriteria((c) => ({ ...c, ...patch }))

  const foodsFn = useCallback(() => {
    void version // refetch when user data changes
    return listFoods()
  }, [version])
  const { data: foods, loading: foodsLoading, error: foodsError } = useAsync(foodsFn)

  const activitiesFn = useCallback(() => {
    void version
    return listActivities()
  }, [version])
  const {
    data: activities,
    loading: activitiesLoading,
    error: activitiesError,
  } = useAsync(activitiesFn)

  const allFoods = useMemo(() => foods ?? [], [foods])
  // Memoized: applyFoodListView/applyActivityListView filter/sort/search the whole list, so
  // without this they reran on every render instead of only when the list or criteria change.
  const foodView = useMemo(
    () => applyFoodListView(allFoods, foodCriteria),
    [allFoods, foodCriteria],
  )
  const allActivities = useMemo(() => activities ?? [], [activities])
  const activityView = useMemo(
    () => applyActivityListView(allActivities, activityCriteria),
    [allActivities, activityCriteria],
  )

  async function removeFood(id: string) {
    await deleteFoodSmart(id)
    bumpDiary()
  }
  async function removeActivity(id: string) {
    await softDeleteActivity(id)
    bumpDiary()
  }
  async function toggleFoodFavorite(id: string, next: boolean) {
    await setFavorite(id, next)
    bumpDiary()
  }

  const tabs = (
    <SegmentedTabs
      value={tab}
      onChange={setTab}
      options={[
        { value: 'foods', label: 'Foods' },
        { value: 'activities', label: 'Activities' },
      ]}
    />
  )

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {tab === 'foods' ? (
        <ListSearchFilterPanel
          sticky
          topExtra={tabs}
          query={foodCriteria.query}
          onQueryChange={(q) => setFoodCrit({ query: q })}
          placeholder="Search foods"
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((o) => !o)}
          sortField={foodCriteria.sortField}
          sortOptions={FOOD_SORT_OPTIONS}
          onSortFieldChange={(f) => setFoodCrit({ sortField: f })}
          sortDir={foodCriteria.sortDir}
          onToggleSortDir={() =>
            setFoodCrit({ sortDir: foodCriteria.sortDir === 'asc' ? 'desc' : 'asc' })
          }
          onClearFilters={() => setFoodCriteria(DEFAULT_FOOD_CRITERIA)}
          hasActiveFilters={
            JSON.stringify(foodCriteria) !== JSON.stringify(DEFAULT_FOOD_CRITERIA)
          }
          extra={
            <span className="flex items-center gap-1.5">
              <span className="text-caption text-text-secondary">Favorites Only</span>
              <Toggle
                checked={foodCriteria.favoritesOnly}
                onChange={(v) => setFoodCrit({ favoritesOnly: v })}
                label="Favorites Only"
              />
            </span>
          }
          filters={
            <div className="grid grid-cols-2 gap-3">
              <SelectMenu
                value={foodCriteria.type}
                options={FOOD_TYPE_OPTIONS}
                onChange={(v) => setFoodCrit({ type: v })}
              />
              <SelectMenu
                value={foodCriteria.source}
                options={FOOD_SOURCE_OPTIONS}
                onChange={(v) => setFoodCrit({ source: v })}
              />
            </div>
          }
          loading={foodsLoading}
          error={foodsError}
          data={foods}
          errorText="Couldn’t load your foods."
          emptyState={<EmptyState title="No foods yet" />}
        >
          {() => {
            const view = foodView
            return (
              <>
                {view.length > 0 && <ResultCount count={view.length} />}
                <div className="flex flex-col gap-2">
                  {view.length === 0 ? (
                    <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-text-tertiary">
                      No matches.
                    </p>
                  ) : (
                    view.map((f) => (
                      <ListRow
                        key={f.id}
                        isFavorite={f.is_favorite}
                        onToggleFavorite={() =>
                          void toggleFoodFavorite(f.id, !f.is_favorite)
                        }
                        onDelete={() => void removeFood(f.id)}
                        // Custom foods open the editor; cached USDA/OFF foods open Food Detail in
                        // `manage` mode so their servings can be viewed/managed without logging a
                        // diary entry (not editable as custom nutrient rows).
                        onClick={() =>
                          openSheet(
                            f.source === 'custom'
                              ? routes.wellness.editFood(f.id)
                              : `${routes.wellness.food('local', f.id)}?mode=manage`,
                          )
                        }
                      >
                        <FoodRowHeader
                          name={f.name}
                          source={f.source as FoodSource}
                          type={f.type as FoodType}
                          nutrientCount={Object.keys(asNutrientMap(f.nutrients)).length}
                          serving={localFoodServing(f.nutrient_basis)}
                        />
                      </ListRow>
                    ))
                  )}
                </div>
                {view.length > 0 && (
                  <ListFab
                    onClick={() => openSheet(routes.wellness.newFood)}
                    label="New Food"
                  />
                )}
              </>
            )
          }}
        </ListSearchFilterPanel>
      ) : (
        <ListSearchFilterPanel
          sticky
          topExtra={tabs}
          query={activityCriteria.query}
          onQueryChange={(q) => setActivityCrit({ query: q })}
          placeholder="Search activities"
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((o) => !o)}
          sortField={activityCriteria.sortField}
          sortOptions={ACTIVITY_SORT_OPTIONS}
          onSortFieldChange={(f) => setActivityCrit({ sortField: f })}
          sortDir={activityCriteria.sortDir}
          onToggleSortDir={() =>
            setActivityCrit({
              sortDir: activityCriteria.sortDir === 'asc' ? 'desc' : 'asc',
            })
          }
          onClearFilters={() => setActivityCriteria(DEFAULT_ACTIVITY_CRITERIA)}
          hasActiveFilters={
            JSON.stringify(activityCriteria) !== JSON.stringify(DEFAULT_ACTIVITY_CRITERIA)
          }
          filters={
            <div className="grid grid-cols-2 gap-3">
              <SelectMenu
                value={activityCriteria.template}
                options={ACTIVITY_TEMPLATE_OPTIONS}
                onChange={(v) => setActivityCrit({ template: v })}
              />
              <SelectMenu
                value={activityCriteria.effort}
                options={ACTIVITY_EFFORT_OPTIONS}
                onChange={(v) => setActivityCrit({ effort: v })}
              />
            </div>
          }
          loading={activitiesLoading}
          error={activitiesError}
          data={activities}
          errorText="Couldn’t load your activities."
          emptyState={<EmptyState title="No activities yet" />}
        >
          {() => {
            const view = activityView
            return (
              <>
                {view.length > 0 && <ResultCount count={view.length} />}
                <div className="flex flex-col gap-2">
                  {view.length === 0 ? (
                    <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-text-tertiary">
                      No matches.
                    </p>
                  ) : (
                    view.map((a) => {
                      const Icon = resolveActivityIcon(a.icon)
                      return (
                        <ListRow
                          key={a.id}
                          leading={<Icon size={22} stroke={1.75} />}
                          onDelete={() => void removeActivity(a.id)}
                          onClick={() => openSheet(routes.wellness.editActivity(a.id))}
                        >
                          <ActivityRowHeader activity={a} />
                        </ListRow>
                      )
                    })
                  )}
                </div>
                {view.length > 0 && (
                  <ListFab
                    onClick={() => openSheet(routes.wellness.newActivity)}
                    label="New Activity"
                  />
                )}
              </>
            )
          }}
        </ListSearchFilterPanel>
      )}
    </div>
  )
}
