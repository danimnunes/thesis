---
"@ebsiint-api/track-and-trace-api-v1": patch
---

Fix `authoriseDid`, `grantAccess` and `revokeAccess` validation: the sender DID must be the same as the access token subject.
