# SecureShare frontend redesign handoff

The redesigned frontend is in `frontendv2/`. Existing browser encryption and backend API modules have not been changed.

## Run

1. Use Node.js 24 or later (the installed ZXing library declares Node >=24).
2. `npm ci`
3. Set `NEXT_PUBLIC_API_URL` in `.env.local` to the deployed API URL or local backend.
4. `npm run build` and `npm run dev`.

## Production verification checklist

- Create a message and open its URL in an incognito session; confirm the fragment key is preserved.
- Check passwords, failed attempts and cooldowns.
- Check view-once and max-view policies.
- Test expiry and access windows.
- Upload and decrypt each allowed attachment type.
- Test camera QR scanning with permissions granted and denied.
- Check dashboard events against backend responses.
- Test on mobile widths and keyboard-only navigation.

## Verification caveat

Dependency installation was attempted in this environment. Offline installation failed because npm packages were not cached; online installation timed out. Consequently a production build and browser end-to-end verification could not be completed here. Do not deploy without running the checklist.
