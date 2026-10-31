---
name: Twistory product direction
description: User-stated priorities and design preferences for the bookcase configurator + community app
---
- The Playroom configurator (ported from github.com/xxashleywang/story-bookcase) is the main product; the community gallery is a secondary add-on.
  **Why:** user said so explicitly.
  **How to apply:** never let community UI crowd or replace the configurator.
- The whole bookcase must be visible on the stage without scrolling (stage is capped to viewport height; the 3D model scales to stage height).
  **Why:** user: "hard for the human brain when you cannot see everything at once."
- Floor picker = one row: Pale oak, Walnut, Grey ash, Oat (carpet), Make your own (color + Wood/Carpet). Say "Wood", never "Laminate" in UI (internal value stays "Laminate" for API/hash compatibility).
- Native browser color inputs look dated to the user; use the custom in-app color picker.
- Loading motion should make the page interesting, have a purpose, and not be distracting.
  **Why:** user explicitly requested this direction.
  **How to apply:** use restrained, finite motion that explains the product; preserve arrangements opened from shared links.
- Avoid native-looking dropdown menus in the configurator; controls should visually match the rest of the page.
  **Why:** the user said the native shelf dropdown looked dated and very different from the page.
  **How to apply:** retain keyboard accessibility while using styled menu surfaces for future configurator dropdowns.
- Starting with Herman Miller Story bookcase; other brands' copies allowed; future expansion to other furniture is a stated interest.
- Prioritize configuring individual shelves before physical assembly and room styling. Do not add permanent gesture instructions, tutorial modals, or repeated hover tooltips.
  **Why:** the user explicitly requested a self-explanatory editing experience without those instructional layers.
  **How to apply:** preserve this scope when revising the configurator; keep assembly tools intact and distinct from design selection.
- The user wants less bold text so emphasis is clear, dislikes arrow icons on arrangement presets, wants Front as the default design view, and All front as the starting arrangement.
  **Why:** the user explicitly gave these visual and interaction preferences.
  **How to apply:** use medium-weight routine controls, reserve stronger weights for emphasis, and use plain-language camera labels rather than “3/4”.
- Keyboard editing should support progressing through shelves without returning to the pointer.
  **Why:** the user expects left/right to keep spinning the current shelf and up/down to move between shelves, rather than four cardinal-direction shortcuts.
  **How to apply:** preserve that distinction when extending keyboard controls; shelf navigation changes selection, not physical height.
