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
- Spiral should be the initial arrangement. Loading motion should make the page interesting, have a purpose, and not be distracting.
  **Why:** user explicitly requested this direction.
  **How to apply:** use restrained, finite motion that explains the product; preserve arrangements opened from shared links.
- Starting with Herman Miller Story bookcase; other brands' copies allowed; future expansion to other furniture is a stated interest.
