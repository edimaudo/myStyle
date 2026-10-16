# myStyle user scenarios

## First-time profile

1. Sign in with the demo account.
2. Start the style quiz.
3. Select at least two style directions, an occasion, a colour palette and a budget.
4. Submit the quiz.
5. Confirm the app returns to Ensemble and displays cards ranked using the answers.

## Custom colour scheme

1. On Ensemble, select My own colour scheme.
2. Enter a few colours such as `olive, cream, rust`.
3. Apply the scheme.
4. Confirm results refresh and the palette label/swatch strip reflects the selection.

## Region and seasonal match

1. Open Style profile.
2. Change country between Canada and United States.
3. Select city / province or state, climate and a season or automatic season.
4. Set a max target per item.
5. Save changes.
6. Confirm currency changes (CAD / USD), the season badge changes, and items above the selected budget are excluded.

## Recommendation feedback

1. On Ensemble, use Save on a card.
2. Open Saved pieces and verify the piece appears.
3. Return to Ensemble and select Not for me on a card.
4. Confirm the card disappears from the refreshed edit and remains excluded in later requests.
5. Use Reset hidden feedback if the edit becomes empty.

## Skin colour analysis

1. Open Skin analysis from the sidebar directly below Ensemble.
2. Select a front-facing JPG/PNG selfie.
3. Confirm the selfie preview is only local.
4. Check the consent box and run analysis.
5. With a valid `YCE_API_KEY`, verify the server uploads the photo to YouCam, creates a skin-tone-analysis task, polls it and returns detected colour values.
6. Confirm skin/hair/eye/brow/lip colour swatches render, the active palette switches to the skin-analysis-guided option, and recommendations refresh.
7. Return to Ensemble and confirm the visible skin-analysis summary appears above the recommendations and recommendation reasons identify skin-colour matches where relevant.
8. Confirm only returned colour values are saved; the actual selfie is not stored in IndexedDB.
9. Without `YCE_API_KEY`, confirm the user sees a clear configuration message and there is no mock success result.

## Limitations to verify in staging

- Editorial images and target price values are inspiration only.
- Shop similar opens a country-aware Google Shopping search, not an affiliate feed or guaranteed matching product.
- Gemini and YouCam live integration require provider keys and are not validated by mocked unit tests.
