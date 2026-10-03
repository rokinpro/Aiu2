import assert from "node:assert/strict";
import test from "node:test";
import { detectPhotoType, photoDraftFromModel } from "../lib/photo";

test("photo assistance accepts supported image signatures and rejects disguised uploads", () => {
  assert.equal(detectPhotoType(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  assert.equal(detectPhotoType(Buffer.from([0, 0, 0, 12, ...Buffer.from("ftypheic")])), "image/heic");
  assert.equal(detectPhotoType(Buffer.from("not an image")), null);
});

test("photo drafts keep observations tentative and strip measurement claims", () => {
  const result = photoDraftFromModel({ features: [
    "stairs", "sign", "stairs", "90 cm wide",
  ] }, "gemini-3.8-flash");
  assert.equal(result.candidates.length, 2);
  assert.match(result.draft, /Photo may show stairs and signage/);
  assert.doesNotMatch(result.draft, /90 cm/);
  assert.match(result.uncertainty, /cannot establish clear width/);
  assert.throws(() => photoDraftFromModel({ features: [3] }, "gemini-3.8-flash"));
});
