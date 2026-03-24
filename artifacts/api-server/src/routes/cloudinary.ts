import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/**
 * DELETE /api/cloudinary/tenant/:tenantId
 *
 * Deletes all Cloudinary files stored under restaurants/{tenantId}/
 * by calling the Cloudinary Admin API for both image and raw (PDF) resource types.
 *
 * Called during account deletion after Firestore data has been removed.
 * The caller must provide the tenantId that matches the restaurant document ID.
 *
 * NOTE: This endpoint does not verify a Firebase ID token because the server
 * does not have the Firebase Admin SDK. A proper token verification layer
 * should be added before exposing this in a fully public deployment.
 */
router.delete("/cloudinary/tenant/:tenantId", async (req, res) => {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    res.status(503).json({
      ok: false,
      error: "Cloudinary credentials not configured on server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    });
    return;
  }

  const { tenantId } = req.params;
  if (!tenantId || tenantId.length < 8) {
    res.status(400).json({ ok: false, error: "Invalid tenantId" });
    return;
  }

  const prefix = `restaurants/${tenantId}`;
  const basicAuth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
  const headers = { Authorization: `Basic ${basicAuth}` };

  const results: { type: string; deleted: Record<string, string> | null; error: string | null }[] = [];

  for (const resourceType of ["image", "raw"] as const) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${resourceType}/upload?prefix=${encodeURIComponent(prefix)}&all=true`;
    try {
      const response = await fetch(url, { method: "DELETE", headers });
      if (response.ok) {
        const data = (await response.json()) as { deleted: Record<string, string> };
        results.push({ type: resourceType, deleted: data.deleted ?? {}, error: null });
      } else {
        const err = (await response.json().catch(() => ({ error: { message: "Unknown error" } }))) as { error: { message: string } };
        results.push({ type: resourceType, deleted: null, error: err?.error?.message ?? `HTTP ${response.status}` });
      }
    } catch (e) {
      results.push({ type: resourceType, deleted: null, error: (e as Error).message });
    }
  }

  const allOk = results.every(r => r.error === null);
  res.status(allOk ? 200 : 207).json({ ok: allOk, results });
});

export default router;
