-- Little Rituals starter ingredient catalog.
-- Safe to rerun: records are identified by the unique slug, and existing rows are left untouched.
-- Run in the Supabase SQL Editor for this project. This script does not alter RLS or the schema.
-- Ingredient notes are general education, not medical advice or a claim of individual suitability.
-- Sources were reviewed on 2026-10-11; URLs are recorded here because the schema has no source field.
-- Moisturizers/barrier: https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer
-- https://dermnetnz.org/topics/emollients-and-moisturisers
-- https://dermnetnz.org/topics/barrier-function-in-atopic-dermatitis
-- Niacinamide: https://dermnetnz.org/topics/nicotinamide
-- Salicylic acid: https://dermnetnz.org/topics/salicylic-acid
-- Azelaic acid: https://dermnetnz.org/topics/azelaic-acid
-- Retinol: https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol
-- Vitamin C: https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-in-your-20s
-- Zinc oxide: https://www.fda.gov/drugs/understanding-over-counter-medicines/sunscreen-how-help-protect-your-skin-sun

insert into public.ingredients (
  slug, name, summary, uses, benefits, cautions,
  suitable_skin_types, caution_skin_types, tags, guidance, interactions, reviewed_at
)
values
  (
    'glycerin', 'Glycerin',
    'A humectant commonly used in moisturizers to attract and retain water in the outer skin layer.',
    array['Humectant in moisturizers and barrier-care products'],
    array['Can support hydration and soften the feel of dry skin'],
    array['The finished formula and other ingredients can still irritate or trigger a reaction in some people.'],
    array['dry','normal'], array[]::text[], array['humectant','hydration','moisturizer'],
    'Use the finished product as labeled. Moisturizers are commonly applied after washing while skin is still slightly damp.',
    array[]::text[], current_date
  ),
  (
    'hyaluronic-acid', 'Hyaluronic acid',
    'A water-binding humectant used in moisturizers to help hydrate the outer skin layer.',
    array['Humectant in serums, creams, and lotions'],
    array['Can help the skin hold water and feel more hydrated'],
    array['A product can still irritate or cause a reaction because of its full formula; results vary.'],
    array['dry','normal'], array[]::text[], array['humectant','hydration','moisturizer'],
    'Follow the finished product label; it is often included in a moisturizer or layered with one.',
    array[]::text[], current_date
  ),
  (
    'niacinamide', 'Niacinamide',
    'Also called nicotinamide, this form of vitamin B3 is used in topical skin-care products.',
    array['Used in moisturizers and other leave-on skin-care products'],
    array['Research suggests topical use may support skin-barrier function and may improve the look of uneven tone or oiliness in some people.'],
    array['Some people experience dryness, stinging, or irritation; evidence and response vary by product and person.'],
    array['normal','oily'], array['sensitive'], array['vitamin-b3','barrier-care','tone'],
    'Use as directed on the finished product. Consider trying one new product at a time and stop if a significant reaction develops.',
    array[]::text[], current_date
  ),
  (
    'ceramides', 'Ceramides',
    'Skin-identical lipids used in moisturizers to help support the outer skin barrier.',
    array['Barrier-support ingredient in creams and lotions'],
    array['Moisturizer formulations with ceramides can help reduce water loss and support skin-barrier care'],
    array['The overall formula, including preservatives or fragrance, may not suit everyone.'],
    array['dry','normal'], array[]::text[], array['barrier-care','lipids','moisturizer'],
    'Follow the moisturizer label. A clinician can advise on persistent dryness or a skin condition.',
    array[]::text[], current_date
  ),
  (
    'petrolatum', 'Petrolatum',
    'An occlusive ingredient that forms a surface layer to reduce water loss from skin.',
    array['Occlusive in ointments and barrier products'],
    array['Can help reduce moisture loss and protect very dry areas'],
    array['Its rich, greasy feel is not preferred by everyone; some occlusive products may aggravate facial acne for some users.'],
    array['dry'], array['oily'], array['occlusive','barrier-care','dryness'],
    'Apply a small amount of the finished product to the intended area as directed. Use clean hands or a clean applicator.',
    array[]::text[], current_date
  ),
  (
    'salicylic-acid', 'Salicylic acid',
    'A beta-hydroxy acid used in some acne and scaling treatments; it helps loosen dead skin cells in follicles.',
    array['Used in some cleansers and leave-on products for acne or scaling'],
    array['Can help loosen clogged follicles and blackheads in acne-prone areas'],
    array['May cause dryness, stinging, irritation, or burning, especially on irritated or broken skin. Follow product warnings and seek professional advice when needed.'],
    array['oily','combination'], array['dry','sensitive'], array['exfoliant','acne-care','bha'],
    'Use only as directed by the product label; avoid irritated or broken skin. Start with the label frequency and stop if significant irritation occurs.',
    array['Using it alongside other exfoliants, retinoids, or acne treatments can increase irritation; check labels or ask a clinician.'], current_date
  ),
  (
    'azelaic-acid', 'Azelaic acid',
    'A topical ingredient used in products for acne and some redness or uneven pigmentation concerns.',
    array['Used in topical acne and rosacea treatments; some products address post-acne marks'],
    array['May help with acne lesions and the appearance of post-inflammatory dark marks in some people'],
    array['Can cause burning, stinging, itching, dryness, or irritation; very sensitive or eczema-prone skin may be more easily irritated.'],
    array['normal','oily'], array['sensitive','dry'], array['acne-care','uneven-tone'],
    'Follow the specific product instructions. Prescription or condition-directed use should follow a clinician’s advice.',
    array[]::text[], current_date
  ),
  (
    'retinol', 'Retinol',
    'An over-the-counter topical retinoid used in some products for acne, uneven tone, and texture.',
    array['Used in selected leave-on skin-care products'],
    array['May improve the appearance of mild acne, uneven tone, and texture over time'],
    array['Can cause dryness, peeling, redness, or irritation and may increase sun sensitivity. Dermatologists advise avoiding retinoids during pregnancy; seek clinician guidance if pregnant, trying to conceive, or breastfeeding.'],
    array['normal','oily'], array['dry','sensitive'], array['retinoid','texture','uneven-tone'],
    'Use the lowest-strength product according to its label and introduce gradually. Use sun protection during the day; consult a dermatologist about suitability.',
    array['Combining with other irritating actives, including exfoliants, can increase irritation; check product instructions or ask a clinician.'], current_date
  ),
  (
    'vitamin-c', 'Vitamin C',
    'A group of antioxidant forms used in topical products, often marketed for uneven tone and visible sun-related changes.',
    array['Used in serums and creams'],
    array['Some formulations may help improve the appearance of dark spots or signs of skin aging; evidence depends on the form and finished product.'],
    array['May sting or irritate, especially if skin is sensitive or already irritated. Topical vitamin C is not a substitute for sunscreen.'],
    array['normal','oily'], array['sensitive'], array['antioxidant','uneven-tone'],
    'Use as directed and discontinue if significant irritation develops. Continue appropriate sun protection.',
    array[]::text[], current_date
  ),
  (
    'zinc-oxide', 'Zinc oxide',
    'A sunscreen active ingredient in some finished products; protection depends on the complete, tested sunscreen formula.',
    array['Active ingredient in some mineral sunscreen products'],
    array['In a properly formulated sunscreen, it helps protect skin from ultraviolet radiation as stated on the product label.'],
    array['A zinc-oxide ingredient by itself is not a complete sunscreen. Texture, other formula ingredients, and individual reactions vary.'],
    array[]::text[], array[]::text[], array['sunscreen','mineral-filter','sun-protection'],
    'Choose a finished sunscreen labeled broad spectrum and use it as directed, including reapplication instructions. Do not rely on raw ingredient or DIY sunscreen mixtures.',
    array[]::text[], current_date
  )
on conflict (slug) do nothing
returning id, slug, name;
