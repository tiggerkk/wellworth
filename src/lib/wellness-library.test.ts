import { describe, expect, it } from 'vitest'
import {
  applyActivityListView,
  applyFoodListView,
  DEFAULT_ACTIVITY_CRITERIA,
  DEFAULT_FOOD_CRITERIA,
  type ActivityRow,
  type FoodRow,
} from './wellness-library'

function food(overrides: Partial<FoodRow>): FoodRow {
  return {
    id: 'f1',
    user_id: 'u1',
    name: 'Apple',
    type: 'food',
    source: 'custom',
    is_favorite: false,
    nutrient_basis: 'per_100g',
    nutrients: {},
    default_serving_id: null,
    external_id: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

function activity(overrides: Partial<ActivityRow>): ActivityRow {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Running',
    template: 'duration',
    default_effort: 'moderate',
    default_duration_min: 30,
    met_by_effort: {},
    icon: null,
    description: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('applyFoodListView', () => {
  const foods = [
    food({ id: '1', name: 'Banana', type: 'food', source: 'usda' }),
    food({ id: '2', name: 'Apple', type: 'food', source: 'custom', is_favorite: true }),
    food({ id: '3', name: 'Vitamin D', type: 'supplement', source: 'off' }),
  ]

  it('sorts by name ascending by default', () => {
    const view = applyFoodListView(foods, DEFAULT_FOOD_CRITERIA)
    expect(view.map((f) => f.name)).toEqual(['Apple', 'Banana', 'Vitamin D'])
  })

  it('filters by type', () => {
    const view = applyFoodListView(foods, {
      ...DEFAULT_FOOD_CRITERIA,
      type: 'supplement',
    })
    expect(view.map((f) => f.id)).toEqual(['3'])
  })

  it('filters by source', () => {
    const view = applyFoodListView(foods, { ...DEFAULT_FOOD_CRITERIA, source: 'usda' })
    expect(view.map((f) => f.id)).toEqual(['1'])
  })

  it('filters by favorites only', () => {
    const view = applyFoodListView(foods, {
      ...DEFAULT_FOOD_CRITERIA,
      favoritesOnly: true,
    })
    expect(view.map((f) => f.id)).toEqual(['2'])
  })

  it('filters by query (zh-folded, case-insensitive)', () => {
    const view = applyFoodListView(foods, { ...DEFAULT_FOOD_CRITERIA, query: 'ban' })
    expect(view.map((f) => f.id)).toEqual(['1'])
  })

  it('sorts by type then name, honoring sortDir', () => {
    const view = applyFoodListView(foods, {
      ...DEFAULT_FOOD_CRITERIA,
      sortField: 'type',
      sortDir: 'desc',
    })
    expect(view.map((f) => f.id)).toEqual(['3', '1', '2'])
  })

  it('sorts by source then name', () => {
    const view = applyFoodListView(foods, {
      ...DEFAULT_FOOD_CRITERIA,
      sortField: 'source',
    })
    expect(view.map((f) => f.id)).toEqual(['2', '3', '1'])
  })
})

describe('applyActivityListView', () => {
  const activities = [
    activity({
      id: '1',
      name: 'Running',
      template: 'duration',
      default_effort: 'vigorous',
    }),
    activity({
      id: '2',
      name: 'Deadlift',
      template: 'strength',
      default_effort: 'moderate',
    }),
    activity({ id: '3', name: 'Walking', template: 'duration', default_effort: 'light' }),
  ]

  it('sorts by name ascending by default', () => {
    const view = applyActivityListView(activities, DEFAULT_ACTIVITY_CRITERIA)
    expect(view.map((a) => a.name)).toEqual(['Deadlift', 'Running', 'Walking'])
  })

  it('filters by template', () => {
    const view = applyActivityListView(activities, {
      ...DEFAULT_ACTIVITY_CRITERIA,
      template: 'strength',
    })
    expect(view.map((a) => a.id)).toEqual(['2'])
  })

  it('filters by effort', () => {
    const view = applyActivityListView(activities, {
      ...DEFAULT_ACTIVITY_CRITERIA,
      effort: 'light',
    })
    expect(view.map((a) => a.id)).toEqual(['3'])
  })

  it('filters by query', () => {
    const view = applyActivityListView(activities, {
      ...DEFAULT_ACTIVITY_CRITERIA,
      query: 'walk',
    })
    expect(view.map((a) => a.id)).toEqual(['3'])
  })

  it('sorts by effort then name', () => {
    const view = applyActivityListView(activities, {
      ...DEFAULT_ACTIVITY_CRITERIA,
      sortField: 'effort',
    })
    expect(view.map((a) => a.id)).toEqual(['3', '2', '1'])
  })
})
