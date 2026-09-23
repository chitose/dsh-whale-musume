# dsh-whale-musume Promo Poster Design

Date: 2026-08-16
Status: Visual direction and copy approved by the user; awaiting written design review

## 1. Goals

Produce one `2048 x 1152` landscape main promo poster. The image must first make viewers feel that Umika has come to the desktop to keep them company, and then, from the real DeepSeek Harness interface, understand that she is an actually running desktop mascot plugin.

The poster does not carry a feature list, version notes, or installation instructions. Features are expressed through the character's actions and the real product environment, not through stacked copy.

## 2. The Only Promo Copy

- Main title: `I'm here to keep you company!`
- Subtitle: `A DeepSeek Harness desktop mascot plugin`

Do not add feature rows, trust rows, version numbers, compatibility information, licenses, data figures, English project names, buttons, or calls to action. Interface text already present in the real DSH screenshot may remain, but no additional product copy may be fabricated.

## 3. Core Concept

Concept name: **She really moved into DSH**

Do not place Umika in an unrelated ocean, candy, or comic scene. The real DSH workspace is the image space: she peeks out from the edge of the input area, picks up her laptop and enters the work state, and can also be picked up and moved with the mouse. The boundary-crossing relationship between the character and the interface is what creates the memorable hook.

## 4. Image Composition

### 4.1 Background and Product Environment

- Use a real light-theme DSH workspace freshly captured from the `v1.1.0` test copy; do not use old promo drafts or AI-generated backgrounds.
- Keep enough DSH branding, workspace structure, and input area for the product identity to be recognizable without explanation.
- The interface exists as one complete environment; no collage of multiple screenshots and no wall of cards.
- Apply only necessary cropping, light/dark control, and depth-of-field layering to the screenshot; do not redraw or fabricate DSH features.

### 4.2 Main Subject

- The only large subject uses `dsh-whale-state-running.webp`, placed in the center-right area of the image, with its height controlled to about `520-600px`.
- The main subject keeps the transparent original art outline, using a natural contact shadow and the product's existing pale-blue work glow.
- No thick white sticker outline, no over-enlarging of the 512px original, and no redrawing the character with a generative model.
- The main subject overlaps the input area in front/behind, so she looks like she is stepping out of the DSH interface rather than being pasted onto the screenshot.

### 4.3 Two Supporting Actions

- `dsh-whale-home-peek.webp` appears at the edge of the input area at close to the real plugin scale, expressing "she lives inside DSH".
- `dsh-whale-state-pick-up.webp` serves as a small action afterimage, paired with a restrained mouse trail, expressing "you can drag her around".
- Both supporting actions are subordinate to the main subject; no standalone cards, borders, titles, or explanatory text.
- Do not lay out more poses, and do not make a sprite art gallery or a sticker-pack collection.

### 4.4 Copy Placement

- The main title sits in the main whitespace on the left of the image, set in a large modern Chinese sans-serif (heiti) face, with priority second only to the character.
- The subtitle follows directly below the main title, at a clearly smaller size, kept to one line.
- The copy forms a diagonal balance with the main subject, and is not placed in a white rounded box, bubble, or glass card.
- Use the locally installed `Noto Sans SC`; the English portion may be typeset in the same font; letter spacing is `0`.

## 5. Color and Texture

- Base colors follow DSH's native black, white, and neutral gray.
- Character blue is the only primary color, drawn from ink blue, indigo, cobalt blue, and a small amount of bright cyan.
- Coral pink and warm yellow may come only from the character's original art or existing interaction effects, and must not expand into large decorative areas.
- No undersea-blue backgrounds, candy-colored grids, gradient light orbs, glowing neon, paper collage, or comic sound effects.
- Overall it should look like a living character has appeared inside a mature developer tool, not like an anime asset poster.

## 6. Production Method

1. Capture a clean DSH workspace screenshot from the current `v1.1.0` test copy.
2. Complete a deterministic composition using the real transparent WebP character assets, with only light outline-preserving upscaling if needed.
3. Render the two lines of text precisely with a local typesetting tool; do not let an image generation model render the copy.
4. Export the `2048 x 1152` PNG main image; produce no additional sizes or derivative versions in this round.

## 7. Acceptance Criteria

- The first-glance focus is Umika and "I'm here to keep you company!"; the second glance identifies the DeepSeek Harness workspace.
- Only two lines of new promo copy appear in the image, and they remain clearly readable when scaled to 25%.
- `running` is the only large subject; `home-peek` and `pick-up` do not compete with it for attention.
- Character edges are clean when viewed at 100%, with no obvious jaggies, blurry edges, thick white borders, or generative repaint artifacts.
- The DSH screenshot comes from the current version; no features are fabricated and no old work skit is used as automatic behavior.
- The PNG is exactly `2048 x 1152`, with no content overflow, occlusion, or accidental cropping.
- The old `promo-poster-v1` through `v4` and their generation scripts are not used as references, are not modified, and do not enter the new deliverable.

## 8. Out of Scope This Round

- Do not modify the README, plugin code, or character assets.
- Do not handle deletion or archiving of the old promo drafts.
- Do not produce social-platform portrait versions, square images, README header images, or animated versions.
- Do not start poster production before the user reviews this design document.
