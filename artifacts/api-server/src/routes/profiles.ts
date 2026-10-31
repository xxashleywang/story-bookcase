import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CheckUsernameAvailabilityQueryParams,
  CheckUsernameAvailabilityResponse,
  GetMyProfileResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { db, profilesTable } from "@workspace/db";
import { getCurrentUserId } from "../lib/auth";

const router: IRouter = Router();
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;

router.get("/profiles/username-availability", async (req, res): Promise<void> => {
  const parsed = CheckUsernameAvailabilityQueryParams.safeParse(req.query);
  if (!parsed.success || !/[A-Za-z0-9]/.test(parsed.data?.username ?? "")) {
    res.status(400).json({ error: "Use 3–24 letters, numbers, periods, underscores, or hyphens." });
    return;
  }

  const username = parsed.data.username;
  const usernameKey = username.toLowerCase();
  const [existing] = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable)
    .where(eq(profilesTable.usernameKey, usernameKey))
    .limit(1);

  res.json(
    CheckUsernameAvailabilityResponse.parse({
      username,
      available: !existing,
    }),
  );
});

router.get("/profiles/me", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to view your profile." });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  res.json(
    GetMyProfileResponse.parse({
      username: profile?.username ?? null,
      displayName: profile?.displayName ?? null,
      isUsernameSet: Boolean(profile?.username),
    }),
  );
});

router.patch("/profiles/me", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to update your profile." });
    return;
  }

  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (
    !parsed.success ||
    !USERNAME_PATTERN.test(parsed.data?.username ?? "") ||
    !/[A-Za-z0-9]/.test(parsed.data?.username ?? "")
  ) {
    res.status(400).json({
      error:
        "Usernames must be 3–24 characters and include at least one letter or number.",
    });
    return;
  }

  const username = parsed.data.username;
  const usernameKey = username.toLowerCase();
  const [existing] = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable)
    .where(eq(profilesTable.usernameKey, usernameKey))
    .limit(1);

  if (existing && existing.userId !== userId) {
    res.status(400).json({ error: "That username is already taken." });
    return;
  }

  try {
    const [profile] = await db
      .insert(profilesTable)
      .values({
        userId,
        username,
        usernameKey,
        displayName: username,
      })
      .onConflictDoUpdate({
        target: profilesTable.userId,
        set: {
          username,
          usernameKey,
          displayName: username,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(
      UpdateMyProfileResponse.parse({
        username: profile.username,
        displayName: profile.displayName,
        isUsernameSet: Boolean(profile.username),
      }),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(400).json({ error: "That username is already taken." });
      return;
    }
    req.log.error({ err: error }, "Could not save username");
    res.status(500).json({ error: "Could not save your username. Try again." });
  }
});

export default router;
