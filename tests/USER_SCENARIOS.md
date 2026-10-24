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

## Ensemble search and shopping

1. Search for a garment, colour, or style such as `navy jacket`, `casual trousers`, or `knitwear`.
2. Confirm the results match the terms instead of returning unrelated catalogue cards.
3. Search a term not represented in the catalogue and confirm a clear no-matches message appears.
4. Clear the search and confirm the normal profile-based recommendations return promptly.
5. Open Buy / Find Similar and confirm it offers Google Shopping comparisons and, for Canadian profiles, Amazon Canada only.

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
8. Confirm returned colour values and the reusable selfie are stored in IndexedDB, and the selfie is not uploaded again without separate consent.
9. Without `YCE_API_KEY`, confirm the user sees a clear configuration message and there is no mock success result.

## Limitations to verify in staging

- Editorial images and target price values are inspiration only.
- Buy opens official store search pages for comparable products, not guaranteed exact SKUs or an affiliate feed.
- Gemini and YouCam live integration require provider keys and are not validated by mocked unit tests.


## Skincare recommendations and saved results

1. Run Facial colour-tone analysis and Skin-health analysis separately, using the same selected selfie and checking the separate consent each time.
2. Open Ensemble Style → Skincare. Before a skin-health result exists, confirm only the “Start with skin-health analysis” prompt is shown in the panel.
3. After a successful skin-health task, return to Ensemble Style → Skincare and verify the stored metrics drive skincare category suggestions without running analysis again.
4. Change skin sensitivity and budget. Confirm the existing recommendations update using the saved analysis and preferences.
5. Open Style quiz and verify it displays existing facial colour notes and skin-health indicators plus the saved sensitivity preference.
6. Change the skin-sensitivity preference in the quiz, submit, and verify the preference remains synchronized with Skincare.

## My closet skincare items and photo picker

1. Open My closet and select Skincare product.
2. Confirm the category dropdown shows cleanser, moisturizer, serum, sunscreen, eye care, treatment, toner/essence, and other skincare.
3. Confirm clothing-only colour and season fields are hidden for skincare, while product details are available.
4. Add a JPG, JPEG or PNG product/package photo with a name and optional notes.
5. Verify the new item appears under All and Skincare, persists after reload, and can be removed.
6. Verify skincare items are not offered as clothing virtual try-on references and do not appear in clothing/accessory matches in Ensemble.
7. Check the Choose file button at mobile and desktop widths, in light/dark themes and small/medium/large text sizes.
