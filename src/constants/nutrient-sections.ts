/**
 * Dashboard / Daily Report section order (docs/01-screens.md). This fixed display order
 * differs from the nutrient table's category order — screens.md is authoritative.
 */
export interface NutrientSection {
  category: string
  label: string
}

export const NUTRIENT_SECTIONS: NutrientSection[] = [
  { category: 'general', label: 'General' },
  { category: 'vitamins', label: 'Vitamins' },
  { category: 'minerals', label: 'Minerals' },
  { category: 'carbohydrates', label: 'Carbohydrates' },
  { category: 'lipids', label: 'Lipids' },
  { category: 'protein', label: 'Protein & Amino Acids' },
]
