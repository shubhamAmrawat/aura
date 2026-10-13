import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, type TestUser } from "../setup/auth";
import { createTestWallpaper } from "../setup/fixtures";
import { expectError, expectKeys, NONEXISTENT_UUID } from "../setup/assert";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let user: TestUser;
let wpId: string;

beforeAll(async () => {
  user = await createUser("likes");
  wpId = await createTestWallpaper(user);
});

const likeCount = async () =>
  (await sql<{ n: number }[]>`SELECT like_count AS n FROM wallpapers WHERE id = ${wpId}`)[0]!.n;

describe("likes", () => {
  it("all routes require auth", async () => {
    expectError(await api("GET", "/api/likes"), 401, "Unauthorized");
    expectError(await api("GET", `/api/likes/${wpId}`), 401, "Unauthorized");
    expectError(await api("POST", `/api/likes/${wpId}`), 401, "Unauthorized");
    expectError(await api("POST", `/api/likes/${wpId}`, { token: "bad" }), 401, "Unauthorized");
  });

  it("toggle like on → list → check → toggle off", async () => {
    expect(await api("GET", `/api/likes/${wpId}`, { token: user.token }).then((r) => r.body)).toEqual({ liked: false });

    const on = await api("POST", `/api/likes/${wpId}`, { token: user.token });
    expect(on.status).toBe(200);
    expect(on.body).toEqual({ liked: true, message: "Liked successfully" });
    expect(await likeCount()).toBe(1);

    const list = await api("GET", "/api/likes", { cookie: user.cookie });
    expect(list.status).toBe(200);
    expectKeys(list.body, ["data"]);
    expect(list.body.data.length).toBe(1);
    expectKeys(list.body.data[0], [
      "id", "title", "fileUrl", "thumbUrl", "blurhash", "dominantColor", "width", "height", "likeCount", "downloadCount", "likedAt",
    ]);
    expect(list.body.data[0].id).toBe(wpId);
    expect(await api("GET", `/api/likes/${wpId}`, { token: user.token }).then((r) => r.body)).toEqual({ liked: true });

    const off = await api("POST", `/api/likes/${wpId}`, { token: user.token });
    expect(off.body).toEqual({ liked: false, message: "Unliked successfully" });
    expect(await likeCount()).toBe(0);
    expect((await api("GET", "/api/likes", { token: user.token })).body).toEqual({ data: [] });
  });

  it("liking a non-existent wallpaper → 500 (FK)", async () => {
    expectError(await api("POST", `/api/likes/${NONEXISTENT_UUID}`, { token: user.token }), 500, "Failed to toggle like");
  });
});
