/**
 * Room-design change detection for the Style it panel.
 *
 * "Changed" means the visible wall color or selected floor differs from the
 * default room. Bookcase size, finish, and shelf directions are intentionally
 * absent so a room reset can leave the bookcase as the user designed it.
 */
export type RoomDesignSnapshot = {
  wall: string;
  floorId: string;
};

/** True when the wall hex or floor id differs from the default room. */
export function roomDesignChanged(room: RoomDesignSnapshot, defaults: RoomDesignSnapshot): boolean {
  return room.wall.toLowerCase() !== defaults.wall.toLowerCase()
    || room.floorId !== defaults.floorId;
}
