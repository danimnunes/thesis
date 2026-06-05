import json
import os
import random
from web3 import Web3
from crypto.kms_manager import KMSManager
from crypto.engines import CryptoEngine
from parser.shredder import FHIRShredder
from database.cloud_manager import CloudManager
from database.rockfs_client import RockFSClient
from dotenv import load_dotenv

# Load Sepolia/Avalanche settings
load_dotenv('/blockchain/.env')
DATA_PATH = "/data"
ABI_PATH = "/blockchain/out/WELLIntegrity.sol/WELLIntegrity.json"

def run_ingestion_and_validation():
    print("\n" + "="*60)
    print("🚀 WELL REPOSITORY: SECURE CLINICAL INGESTION PIPELINE")
    print("="*60)

    # --- 1. INFRASTRUCTURE INITIALIZATION ---
    print(f"\n[1/7] Initializing Infrastructure...")
    PRIVATE_KEY = os.getenv("PRIVATE_KEY")
    RPC_URL = os.getenv("RPC_URL")
    WELL_INTEGRITY_ADDR = os.getenv("WELL_INTEGRITY_ADDR")
    
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    account = w3.eth.account.from_key(PRIVATE_KEY)
    print(f"    - Connected to Blockchain: {RPC_URL}")
    print(f"    - Authorized Data Client: {account.address}")
    print(f"    - Orchestrator Contract: {WELL_INTEGRITY_ADDR}")

    kms = KMSManager()
    shredder = FHIRShredder()
    cloud = CloudManager()
    rockfs = RockFSClient()
    
    # Key Derivation
    db_key = kms.derive_key("MULTI_CLOUD_REPLICA_KEY")
    engine = CryptoEngine(db_key)
    print(f"    - KMS: Master Key retrieved from Vault. Session key derived via HKDF.")

    # --- 2. FHIR SHREDDING ---
    print(f"\n[2/7] Executing Intelligent FHIR Shredding...")
    
    files = [f for f in os.listdir(DATA_PATH) if f.endswith('.json') and "Information" not in f]
    
    selected_file = random.choice(files) if files else None
    if not selected_file:
        print(f"    ❌ No valid Patient FHIR JSON files found in {DATA_PATH}. Exiting.")
        return
        
    print(f"    - Selected FHIR Bundle: {selected_file}")
    with open(os.path.join(DATA_PATH, selected_file), encoding='utf-8') as f:
        bundle = json.load(f)
    
    shredded = shredder.shred(bundle)

    if 'last_name' not in shredded['sse'] or not shredded['sse']['last_name']:
        print(f"    ⚠️  Selected file {selected_file} does not contain valid Patient metadata. Please try again.")
        return

    patient_name = shredded['sse']['last_name'][0]
    unique_diagnoses = ", ".join(shredded['sse']['diagnosis'][:3]) + "..."
    
    print(f"    - Resource Type: {bundle['resourceType']}")
    print(f"    - Patient Identified: {patient_name}")
    print(f"    - Cleaned Diagnoses (SSE): {unique_diagnoses}")

    # --- 3. UNSTRUCTURED DATA STORAGE (ROCKFS) ---
    print(f"\n[3/7] Processing Unstructured Assets (RockFS)...")
    dummy_binary = b"RIFF....WAVEfmt...data...[SIMULATED_XRAY_IMAGE]"
    blob_id = rockfs.save_blob(dummy_binary, ".jpg")
    print(f"    - Object decoupled from metadata. ID: {blob_id}")

    # --- 4. HYBRID ENCRYPTION ENGINE ---
    print(f"\n[4/7] Applying Hybrid Encryption Strategy...")
    # SSE - Using the specific UUID and last name extracted
    enc_sse = {
        "patient_id": engine.encrypt_sse(shredded['sse']['patient_id'][0]),
        "last_name": engine.encrypt_sse(patient_name),
        "diagnosis": engine.encrypt_sse(shredded['sse']['diagnosis'][0]) if shredded['sse']['diagnosis'] else "None"
    }
    print(f"    - SSE Engine: Generated deterministic tokens for searchable fields.")
    
    cost = float(shredded['phe']['medical_costs'][0]) if shredded['phe']['medical_costs'] else 100.0
    weight = float(shredded['phe']['weight'][0]) if shredded['phe']['weight'] else 70.0
    
    enc_cost = engine.encrypt_phe(cost)
    enc_weight = engine.encrypt_phe(weight)
    
    enc_phe = {
        "medical_costs": str(enc_cost.ciphertext()),
        "weight": str(enc_weight.ciphertext())
    }
    print(f"    - PHE Engine: Generated Paillier ciphertext for numerical analytics.")

    # --- 5. BLOCKCHAIN ANCHORING ---
    print(f"\n[5/7] Executing EBSI Triple Trust Chain Anchoring...")
    with open(ABI_PATH) as f:
        abi = json.load(f)['abi']
    integrity_contract = w3.eth.contract(address=WELL_INTEGRITY_ADDR, abi=abi)
    
    integrity_hash = w3.keccak(text=enc_sse['patient_id'])
    nonce = w3.eth.get_transaction_count(account.address)
    
    build_tx = integrity_contract.functions.anchorEhr(
        integrity_hash, 
        "did:ebsi:hospital-test"
    ).build_transaction({
        'chainId': 43113, 'gas': 500000, 'nonce': nonce,
        'maxFeePerGas': w3.to_wei('30', 'gwei'), 'maxPriorityFeePerGas': w3.to_wei('25', 'gwei')
    })
    
    signed_tx = w3.eth.account.sign_transaction(build_tx, private_key=PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    print(f"    - Transaction signed and propagated. Hash: {tx_hash.hex()[:20]}...")
    
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"    - Block confirmed: {receipt.blockNumber} | Gas used: {receipt.gasUsed}")

    # --- 6. MULTI-CLOUD PERSISTENCE ---
    print(f"\n[6/7] Distributing Encrypted Payload to Multi-Cloud...")
    cloud.save_record(enc_sse, enc_phe, blob_id, json.dumps(bundle).encode(), tx_hash.hex())

    # --- 7. VALIDATION EXPERIENCES ---
    print(f"\n" + "-"*40)
    print("🔬 RUNNING ON-THE-FLY SYSTEM VALIDATION")
    print("-"*40)
    
    # Exp A: Search
    print(f"🔍 [Search Test] Can the Database find the patient '{patient_name}' using only the SSE Token?")
    db_record = cloud.search_by_token("last_name_sse", enc_sse['last_name'])
    if db_record:
        print(f"    ✅ SUCCESS: Record matched in Cloud.")
    else:
        print(f"    ❌ FAIL: Token mismatch in Database.")

if __name__ == "__main__":
    run_ingestion_and_validation()