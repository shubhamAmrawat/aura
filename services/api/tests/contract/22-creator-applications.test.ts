import { beforeAll, describe, expect, it } from "vitest";
import { api } from "../setup/http";
import { sql } from "../setup/db";
import { createUser, makeAdmin, type TestUser } from "../setup/auth";
import { expectError } from "../setup/assert";
import { pngOf } from "../setup/images";
import { useTestCleanup } from "../setup/lifecycle";

useTestCleanup();

let admin: TestUser;
let ana: TestUser; // gets rejected 3 times
let ben: TestUser; // gets approved

beforeAll(async () => {
  [admin, ana, ben] = await Promise.all([createUser("cap-admin"), createUser("cap-ana"), createUser("cap-ben")]);
  await makeAdmin(admin);
});

/** Upload one sample the way the web/app does: signed URL → PUT → confirm. */
async function addSample(u: TestUser, w = 1200, h = 1800) {
  const bytes = await pngOf(w, h);
  const url = await api("POST", "/api/creator/samples/upload-url", { token: u.token, json: { fileType: "image/png", size: bytes.length } });
  expect(url.status).toBe(200);
  const put = await fetch(url.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Uint8Array(bytes) });
  expect(put.status).toBe(200);
  return api("POST", "/api/creator/samples", { token: u.token, json: { key: url.body.key } });
}

async function apply(u: TestUser) {
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await addSample(u);
    expect(r.status).toBe(200);
    ids.push(r.body.sample.id);
  }
  return api("POST", "/api/creator/application", { token: u.token, json: { sampleIds: ids, about: "I shoot landscapes.", portfolioUrl: "instagram.com/test" } });
}

const adminCall = (method: string, path: string, json?: unknown) =>
  api(method, `/api/admin/creator-applications${path}`, { token: admin.token, ...(json ? { json } : {}) });

describe("creator applications", () => {
  it("needs a signed-in user", async () => {
    expectError(await api("GET", "/api/creator/application"), 401, "Unauthorized");
  });

  it("starts with no application and the rules", async () => {
    const res = await api("GET", "/api/creator/application", { token: ana.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isCreator: false, canApply: true, nextApplyAt: null, triesBeforePause: 3, application: null });
    expect(res.body.rules).toMatchObject({ minSamples: 3, maxSamples: 6, minShortSide: 1080 });
  });

  it("checks file type, size and resolution", async () => {
    expectError(
      await api("POST", "/api/creator/samples/upload-url", { token: ana.token, json: { fileType: "image/gif", size: 100 } }),
      400, "Use a JPG, PNG or WebP image."
    );
    expectError(
      await api("POST", "/api/creator/samples/upload-url", { token: ana.token, json: { fileType: "image/png", size: 30 * 1024 * 1024 } }),
      400, "Each image must be smaller than 25 MB."
    );
    expectError(await addSample(ana, 800, 1200), 400, "This image is 800 × 1200. Use at least 1080 px on the short side.");
    expectError(await api("POST", "/api/creator/samples", { token: ana.token, json: { key: `applications/${ben.id}/x.png` } }), 400, "Invalid upload.");
  });

  it("removes an unsent sample, and needs 3–6 samples to apply", async () => {
    const s = await addSample(ana);
    expect(s.status).toBe(200);
    expect(s.body.sample).toMatchObject({ width: 1200, height: 1800 });
    expect(s.body.sample.thumbUrl).toMatch(/^https:\/\//);
    expectError(
      await api("POST", "/api/creator/application", { token: ana.token, json: { sampleIds: [s.body.sample.id] } }),
      400, "Add 3 to 6 wallpapers."
    );
    expect((await api("DELETE", `/api/creator/samples/${s.body.sample.id}`, { token: ana.token })).status).toBe(200);
    expectError(await api("DELETE", `/api/creator/samples/${s.body.sample.id}`, { token: ana.token }), 404, "Sample not found.");
  });

  it("submits, then blocks a second application while in review", async () => {
    const res = await apply(ana);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ canApply: false, application: { status: "pending" } });
    expect(res.body.application.samples).toHaveLength(3);
    const [row] = await sql`SELECT portfolio_url FROM creator_applications WHERE id = ${res.body.application.id}`;
    expect(row!.portfolio_url).toBe("https://instagram.com/test");
    expectError(
      await api("POST", "/api/creator/samples/upload-url", { token: ana.token, json: { fileType: "image/png", size: 100 } }),
      409, "Your application is already in review."
    );
  });

  it("admin: lists, shows and rejects with a note; 3rd rejection starts a 1-day pause", async () => {
    expectError(await api("GET", "/api/admin/creator-applications", { token: ana.token }), 403, "Admin access required.");

    for (let round = 1; round <= 3; round++) {
      if (round > 1) expect((await apply(ana)).status).toBe(200);
      const list = await adminCall("GET", "?status=pending");
      expect(list.status).toBe(200);
      const mine = list.body.data.find((a: { userId: string }) => a.userId === ana.id);
      expect(mine).toMatchObject({ sampleCount: 3, status: "pending" });

      const detail = await adminCall("GET", `/${mine.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({ attempt: round, rejectionsBefore: round - 1, pausesOnReject: round === 3 });
      expect(detail.body.samples).toHaveLength(3);

      expectError(await adminCall("POST", `/${mine.id}/reject`, {}), 400, "Add a note for the applicant (3–500 characters).");
      const rej = await adminCall("POST", `/${mine.id}/reject`, { note: "Needs sharper originals." });
      expect(rej.status).toBe(200);
      expect(rej.body.status).toBe("rejected");
      expectError(await adminCall("POST", `/${mine.id}/approve`, {}), 409, "This application was already decided.");

      const st = await api("GET", "/api/creator/application", { token: ana.token });
      expect(st.body.application).toMatchObject({ status: "rejected", note: "Needs sharper originals." });
      if (round < 3) {
        expect(st.body).toMatchObject({ canApply: true, nextApplyAt: null, triesBeforePause: 3 - round });
      } else {
        expect(st.body.canApply).toBe(false);
        const wait = new Date(st.body.nextApplyAt).getTime() - Date.now();
        expect(wait).toBeGreaterThan(23 * 3600_000);
        expect(wait).toBeLessThanOrEqual(24 * 3600_000);
      }
    }
    expectError(
      await api("POST", "/api/creator/samples/upload-url", { token: ana.token, json: { fileType: "image/png", size: 100 } }),
      429, "You can apply again after your pause ends."
    );
  }, 150_000);

  it("admin: approving makes the user a creator", async () => {
    expect((await apply(ben)).status).toBe(200);
    const list = await adminCall("GET", "?status=pending");
    const app = list.body.data.find((a: { userId: string }) => a.userId === ben.id);
    const res = await adminCall("POST", `/${app.id}/approve`, { note: "" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    const [u] = await sql`SELECT is_creator FROM users WHERE id = ${ben.id}`;
    expect(u!.is_creator).toBe(true);
    const st = await api("GET", "/api/creator/application", { token: ben.token });
    expect(st.body).toMatchObject({ isCreator: true, canApply: false });
    const [log] = await sql`SELECT action FROM admin_actions WHERE target_id = ${ben.id} ORDER BY created_at DESC LIMIT 1`;
    expect(log!.action).toBe("creator.application.approve");
    const counts = await adminCall("GET", "/counts");
    expect(counts.body.approved).toBeGreaterThanOrEqual(1);
  });
});
