# Optional community analytics

Uses only the platform-provided optional `window.umami` tracker. No scripts,
analytics configuration, browsing restrictions, or sign-in requirements are added.
If analytics is absent, blocked, or fails, the app continues normally.

| Event name | Description | Fixed dimensions |
| --- | --- | --- |
| `room_published` | Create request succeeded; attachment type comes from the saved response, not the initial checkbox | `source`: `gallery` / `playroom`; `type`: `photo_only` / `blueprint_backed` |
| `blueprint_used` | Community blueprint reached the Playroom and scene update completed | `source`: `room_detail` / `inspiration_drawer`; `type`: `blueprint_backed` |
| `inspiration_reference_opened` | Reference photo loaded successfully in the Playroom | `source`: `room_detail` / `inspiration_drawer`; `type`: `photo_only` |
| `inspiration_reference_dismissed` | Reference was removed from Playroom state and URL | `source`: `playroom`; `type`: `reference` |

No titles, usernames, IDs, photo URLs, configurations, or free-form content are
passed as custom event properties. Curated preset looks and direct shared links
are not counted as community inspiration actions.

Inspiration navigation carries a fixed action/source query label, consumed once
at the successful destination. Failed navigation, unavailable references, broken
reference images, cancelled publishing, and failed uploads/creates do not count
as successful outcomes. Refreshing after completion does not repeat the handoff
event. Dismissal also removes an unfinished reference marker.

Collection depends on analytics being enabled in Publishing settings for a
published app version containing these changes. This code does not enable
analytics, install a tracker, or publish the app.

These events measure actions, not proof of a completed room design. Useful
questions once data exists:
- What share of published rooms include a blueprint?
- Are detail pages or the inspiration drawer used more to start designing?
- How often are photo references opened versus dismissed?
