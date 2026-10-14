# styleTV user scenarios

## 1. Browse the daytime directory

- Sign in with the demo account.
- Search for a daytime programme such as `The View` or `Today`.
- Confirm the selected programme appears first in Discover.
- Open `View actual outfits` and verify it navigates directly to the programme's WornOnTV wardrobe page.
- Confirm there are no generic sample garment/product cards presented as outfits from the programme.

## 2. Personalize show recommendations

- Add one or two programmes to `My shows`.
- Complete the style quiz and choose a few style directions/patterns.
- Return to Discover and confirm the recommended daytime wardrobe sources update.
- Use the on-screen integration status and result message to tell whether Gemini ranked the request or the local profile matcher was used.

## 3. Virtual try-on with the selected outfit

- Open a show's outfit listings on WornOnTV to inspect documented outfits.
- Open `Try on an outfit` from the show's card.
- Upload a personal photo and an outfit-reference image that you own or have permission to submit for AI processing. Do not copy/upload WornOnTV materials without permission under its terms.
- Confirm the consent checkbox is required and no image is uploaded when consent is absent.
- With `YCE_API_KEY` configured, confirm the backend uploads both files to YouCam's File API, invokes Clothes V4 with `src_file_id` and `ref_file_id`, polls the real task, and displays the returned result URL.
- Without `YCE_API_KEY`, confirm the UI explains the integration is not configured and does not display a fabricated result.

## 4. Facial colour-tone analysis

- In My style profile, select a front-facing selfie and explicitly consent.
- With `YCE_API_KEY` configured, confirm the backend uploads the photo and starts the YouCam skin-tone-analysis task.
- Confirm result colours are saved locally but the image itself is not stored by styleTV.
- Without the key, confirm the UI clearly reports that live processing is unavailable.

## 5. Saved wardrobes

- Add a daytime programme to My shows.
- Open Saved wardrobes and confirm the programme appears with its direct WornOnTV link.
- Remove the programme from My shows and confirm it no longer appears in Saved wardrobes.

## Known source constraint

WornOnTV's current Terms of Use prohibit copying its materials or mirroring them on another server. Until a supported data feed/API or written permission is obtained, styleTV links to the actual outfit pages rather than copying WornOnTV's outfit records or photos into its own catalogue.
