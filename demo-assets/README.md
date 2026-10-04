# Photo assistant sample images

The Aiu2 logo is available as a [scalable wordmark](aiu2-logo.svg) and a [transparent PNG](aiu2-logo.png). The square app icon is available as a [512-pixel PNG](aiu2-icon.png) or the original [`app/icon.svg`](../app/icon.svg). The SVGs stay sharp when resized.

These three PNGs are synthetic illustrations for trying the photo-assisted report flow. They do not depict a real campus location or establish accessibility, dimensions, or current conditions.

| File | Visible features to try |
| --- | --- |
| `synthetic-stairs-signage.png` | Stairs and signage |
| `synthetic-ramp-entrance.png` | Ramp, entrance and signage |
| `synthetic-resting-bench.png` | Bench and signage |

In Aiu2, open **Share an update**, choose one image, then select **Analyze photo**. Review the candidate features and missing details. The interpretation may vary between model calls. The generated text is an editable draft; do not submit these synthetic images as real observations. Photo assistance requires `GEMINI_API_KEY` and `GEMINI_MODEL_ID` in the server's ignored `.env.local` file.

All three files were sent to the configured Gemini model on 2026-10-03. It returned the listed features as *possible* candidates; none was saved as a report.
