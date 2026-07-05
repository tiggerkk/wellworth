-- Seed the nutrient reference table (docs/05-seed-data.md).
--
-- Idempotent: ON CONFLICT (key) DO UPDATE so this reaches production via `supabase db push`
-- and is safe to re-run (and lets a future migration correct values). default_visible is the same as
-- the doc's "Visible = yes"; has_upper_limit is the same as "UL". DRI target/UL numeric values live in
-- src/lib/dri.ts, not here. parent_key nests sub-nutrients (validated by the deferrable self-FK).
--
-- category-level display order (General, Vitamins, Minerals, Carbohydrates, Lipids,
-- Protein & Amino Acids) is applied in the app; sort_order orders nutrients within a category.

insert into public.nutrient
  (key, display_name, unit, category, parent_key, sort_order, default_visible, has_upper_limit)
values
  -- General
  ('energy', 'Energy', 'kcal', 'general', null, 10, true, false),
  ('water', 'Water', 'g', 'general', null, 20, true, false),
  ('alcohol', 'Alcohol', 'g', 'general', null, 30, false, false),
  ('caffeine', 'Caffeine', 'mg', 'general', null, 40, false, false),

  -- Protein & Amino Acids
  ('protein', 'Protein', 'g', 'protein', null, 10, true, false),
  ('histidine', 'Histidine', 'g', 'protein', 'protein', 20, false, false),
  ('isoleucine', 'Isoleucine', 'g', 'protein', 'protein', 30, false, false),
  ('leucine', 'Leucine', 'g', 'protein', 'protein', 40, false, false),
  ('lysine', 'Lysine', 'g', 'protein', 'protein', 50, false, false),
  ('methionine', 'Methionine', 'g', 'protein', 'protein', 60, false, false),
  ('phenylalanine', 'Phenylalanine', 'g', 'protein', 'protein', 70, false, false),
  ('threonine', 'Threonine', 'g', 'protein', 'protein', 80, false, false),
  ('tryptophan', 'Tryptophan', 'g', 'protein', 'protein', 90, false, false),
  ('valine', 'Valine', 'g', 'protein', 'protein', 100, false, false),
  ('alanine', 'Alanine', 'g', 'protein', 'protein', 110, false, false),
  ('arginine', 'Arginine', 'g', 'protein', 'protein', 120, false, false),
  ('aspartic_acid', 'Aspartic acid', 'g', 'protein', 'protein', 130, false, false),
  ('cystine', 'Cystine', 'g', 'protein', 'protein', 140, false, false),
  ('glutamic_acid', 'Glutamic acid', 'g', 'protein', 'protein', 150, false, false),
  ('glycine', 'Glycine', 'g', 'protein', 'protein', 160, false, false),
  ('proline', 'Proline', 'g', 'protein', 'protein', 170, false, false),
  ('serine', 'Serine', 'g', 'protein', 'protein', 180, false, false),
  ('tyrosine', 'Tyrosine', 'g', 'protein', 'protein', 190, false, false),

  -- Carbohydrates
  ('carbs', 'Carbs (Total)', 'g', 'carbohydrates', null, 10, true, false),
  ('fiber', 'Fiber', 'g', 'carbohydrates', 'carbs', 20, true, false),
  ('starch', 'Starch', 'g', 'carbohydrates', 'carbs', 30, false, false),
  ('sugars', 'Sugars', 'g', 'carbohydrates', 'carbs', 40, false, false),
  ('added_sugars', 'Added Sugars', 'g', 'carbohydrates', 'carbs', 50, false, true),
  ('net_carbs', 'Net Carbs', 'g', 'carbohydrates', 'carbs', 60, false, false),
  ('fructose', 'Fructose', 'g', 'carbohydrates', 'sugars', 70, false, false),
  ('galactose', 'Galactose', 'g', 'carbohydrates', 'sugars', 80, false, false),
  ('glucose', 'Glucose', 'g', 'carbohydrates', 'sugars', 90, false, false),
  ('lactose', 'Lactose', 'g', 'carbohydrates', 'sugars', 100, false, false),
  ('maltose', 'Maltose', 'g', 'carbohydrates', 'sugars', 110, false, false),
  ('sucrose', 'Sucrose', 'g', 'carbohydrates', 'sugars', 120, false, false),

  -- Lipids
  ('fat', 'Fat', 'g', 'lipids', null, 10, true, false),
  ('monounsaturated', 'Fat (Monounsaturated)', 'g', 'lipids', 'fat', 20, true, false),
  ('polyunsaturated', 'Fat (Polyunsaturated)', 'g', 'lipids', 'fat', 30, true, false),
  ('omega3', 'Omega-3', 'g', 'lipids', 'polyunsaturated', 40, true, false),
  ('omega6', 'Omega-6', 'g', 'lipids', 'polyunsaturated', 50, true, false),
  ('saturated', 'Fat (Saturated)', 'g', 'lipids', 'fat', 60, true, false),
  ('trans', 'Fat (Trans)', 'g', 'lipids', 'fat', 70, true, false),
  ('cholesterol', 'Cholesterol', 'mg', 'lipids', null, 80, true, false),
  ('ala', 'ALA (18:3)', 'g', 'lipids', 'omega3', 90, false, false),
  ('epa', 'EPA (20:5)', 'g', 'lipids', 'omega3', 100, false, false),
  ('dha', 'DHA (22:6)', 'g', 'lipids', 'omega3', 110, false, false),
  ('linoleic', 'Linoleic (18:2)', 'g', 'lipids', 'omega6', 120, false, false),
  ('arachidonic', 'Arachidonic (20:4)', 'g', 'lipids', 'omega6', 130, false, false),
  ('palmitic', 'Palmitic (16:0)', 'g', 'lipids', 'saturated', 140, false, false),
  ('stearic', 'Stearic (18:0)', 'g', 'lipids', 'saturated', 150, false, false),
  ('oleic', 'Oleic (18:1)', 'g', 'lipids', 'monounsaturated', 160, false, false),

  -- Vitamins
  ('vitamin_a', 'Vitamin A', 'µg', 'vitamins', null, 10, true, true),
  ('vitamin_c', 'Vitamin C', 'mg', 'vitamins', null, 20, true, true),
  ('vitamin_d', 'Vitamin D', 'µg', 'vitamins', null, 30, true, true),
  ('vitamin_e', 'Vitamin E', 'mg', 'vitamins', null, 40, true, true),
  ('vitamin_k', 'Vitamin K', 'µg', 'vitamins', null, 50, true, false),
  ('b1', 'B1 (Thiamine)', 'mg', 'vitamins', null, 60, true, false),
  ('b2', 'B2 (Riboflavin)', 'mg', 'vitamins', null, 70, true, false),
  ('b3', 'B3 (Niacin)', 'mg', 'vitamins', null, 80, true, true),
  ('b5', 'B5 (Pantothenic Acid)', 'mg', 'vitamins', null, 90, true, false),
  ('b6', 'B6 (Pyridoxine)', 'mg', 'vitamins', null, 100, true, true),
  ('b12', 'B12 (Cobalamin)', 'µg', 'vitamins', null, 110, true, false),
  ('folate', 'Folate', 'µg', 'vitamins', null, 120, true, true),
  ('b7', 'B7 (Biotin)', 'µg', 'vitamins', null, 130, false, false),
  ('choline', 'Choline', 'mg', 'vitamins', null, 140, false, true),

  -- Minerals
  ('calcium', 'Calcium', 'mg', 'minerals', null, 10, true, true),
  ('copper', 'Copper', 'mg', 'minerals', null, 20, true, true),
  ('iodine', 'Iodine', 'µg', 'minerals', null, 30, true, true),
  ('iron', 'Iron', 'mg', 'minerals', null, 40, true, true),
  ('magnesium', 'Magnesium', 'mg', 'minerals', null, 50, true, true),
  ('manganese', 'Manganese', 'mg', 'minerals', null, 60, true, true),
  ('phosphorus', 'Phosphorus', 'mg', 'minerals', null, 70, true, true),
  ('potassium', 'Potassium', 'mg', 'minerals', null, 80, true, false),
  ('selenium', 'Selenium', 'µg', 'minerals', null, 90, true, true),
  ('sodium', 'Sodium', 'mg', 'minerals', null, 100, true, true),
  ('zinc', 'Zinc', 'mg', 'minerals', null, 110, true, true),
  ('chromium', 'Chromium', 'µg', 'minerals', null, 120, false, false),
  ('fluoride', 'Fluoride', 'mg', 'minerals', null, 130, false, true),
  ('molybdenum', 'Molybdenum', 'µg', 'minerals', null, 140, false, true),
  ('chloride', 'Chloride', 'mg', 'minerals', null, 150, false, true)
on conflict (key) do update set
  display_name = excluded.display_name,
  unit = excluded.unit,
  category = excluded.category,
  parent_key = excluded.parent_key,
  sort_order = excluded.sort_order,
  default_visible = excluded.default_visible,
  has_upper_limit = excluded.has_upper_limit;
