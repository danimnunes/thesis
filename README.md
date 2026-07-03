# WELL Repository: A Decentralized and Secure Repository for EHRs

## Overview
The **WELL Repository** is a secure, decentralized framework for managing Electronic Health Records (EHR) designed to be fully compliant with the **European Health Data Space (EHDS)** regulations. 

The system implements a **Hybrid Poly-encrypted Multi-cloud Architecture** that resolves the conflict between data utility (research and searchability) and patient privacy. It integrates the official **European Blockchain Services Infrastructure (EBSI)** standards to provide a "Triple Trust Chain" for clinical data.

## Key Architectural Pillars
*   **Storage Decoupling:** Structured clinical metadata (HL7 FHIR) is managed via a Secure Indexing Layer, while heavy unstructured assets (images/PDFs) are handled by **RockFS** (https://github.com/davidmatos/RockFS) using Erasure Coding.
*   **Hybrid Encryption Engine:** Combines Searchable Symmetric Encryption (**SSE**) for high-speed record filtering and Partially Homomorphic Encryption (**PHE - Paillier**) for privacy-preserving clinical analytics.
*   **Trust Layer (EBSI v4/v5):** On-chain validation of Identity (**DID Registry**), Accreditation (**Trusted Issuers Registry**), and Integrity (**Timestamping**).
*   **Modular Deployment & DI:** Bypasses network bytecode limits through an orchestrated 5-stage pipeline and implements **Dependency Injection** via a central `WELLRegistry` (Service Locator pattern).

---

## Project Structure
```text
thesis/
├── blockchain/          # Solidity Smart Contracts & Foundry Environment
│   ├── lib/             # EBSI Core Services (v4/v5) via Git Submodules
│   ├── script/          # 5-Stage Orchestrated Deployment Scripts
│   └── src/             # WELL Core Logic & Registry
├── client/              # Python Data Client (Dockerized)
│   ├── src/
│   │   ├── crypto/      # KMS (Vault), SSE, and PHE Engines
│   │   ├── database/    # Multi-cloud Manager (Postgres/MySQL) & RockFS Client
│   │   └── parser/      # FHIR Shredder using FHIRPath
│   └── tests/           # Integration & Performance Tests
└── synthea_data/        # Synthetic HL7 FHIR Patient Bundles
```

---

## Prerequisites
*   **Docker & Docker Compose**
*   **Foundry** (Forge, Cast, Anvil)
*   **Python 3.12+**

---

## Getting Started

### 1. Environment Setup
Initialize submodules and create a `.env` file in the `blockchain/` directory:
```bash
git submodule update --init --recursive
```
`.env` content:
```text
PRIVATE_KEY=0x...
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc # Avalanche Fuji
```

### 2. Infrastructure Launch
Start the microservices ecosystem (Vault, Postgres, MySQL, MinIO, RockFS, and Data Client):
```bash
docker compose up --build -d
```

### 3. Blockchain Deployment (The Trust Chain)
Execute the modular deployment sequence from the `blockchain/` folder. **Update the `.env` file with the generated addresses after each step**:
```bash
# 1. Base Infra
forge script script/Deploy1_Infra.s.sol --rpc-url $RPC_URL --broadcast --legacy
# 2. Identity
forge script script/Deploy2_DID.s.sol --rpc-url $RPC_URL --broadcast --legacy
# 3. Authorization
forge script script/Deploy3_TIR.s.sol --rpc-url $RPC_URL --broadcast --legacy
# 4. Integrity
forge script script/Deploy4_TS.s.sol --rpc-url $RPC_URL --broadcast --legacy
# 5. WELL Core
forge script script/Deploy5_WELL.s.sol --rpc-url $RPC_URL --broadcast --legacy
```

---

## Data Ingestion & Evaluation

Once the infrastructure is ready, enter the client container to execute the clinical data pipeline:

```bash
docker exec -it well_client bash

# 1. Initialize Database Schemas
python3 src/database/setup_db.py

# 2. Run Full Ingestion & Validation Experiences
python3 src/main.py
```

### Automated Experiments
The system is designed to provide immediate scientific validation:
*   **SSE Validation:** Confirms that encrypted records are retrievable via deterministic tokens.
*   **PHE Validation:** Demonstrates server-side homomorphic summation of medical costs without decryption.
*   **Integrity Proof:** Verifies the anchored hash on the Avalanche Fuji network.

---

## Author
*   **Daniel Martins Nunes** - [daniel.m.nunes@tecnico.ulisboa.pt](mailto:daniel.m.nunes@tecnico.ulisboa.pt)
*   **Supervisors:** Prof. David Rogério Póvoa de Matos, Prof. António Rito Silva.

**Instituto Superior Técnico, Universidade de Lisboa (2026)**
