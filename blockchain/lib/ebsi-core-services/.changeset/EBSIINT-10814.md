---
"@ebsiint-sc/admin-scripts": minor
---

create 2 private keys: TPR operator (tprOp), and Support Office (SO).
Assign the "operator role" to the tprOp in the TPR.
Use the tprOp create policies in the TPR (insertPolicy) and assign these policies to the SO (insertUserAttributes)
Register DIDs for tprOp and SO in the did registry
Use the SO to register hash algs in timestamp sc (insertHashAlgorithm)
Register the SO in the TIR as roottao
Use the SO to register the schemas (https://code.europa.eu/ebsi/json-schema/-/tree/main)
