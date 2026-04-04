---
"@ebsiint-api/authorisation-api-v4": patch
---

Add `ES256K` to supported algorithms for `didr_write`, `didr_invite`, `tnt_authorise`, `tnt_create` and `tnt_write` presentations.
Verify that the VP and VC algorithm matches the one requested in the presentation definition.
