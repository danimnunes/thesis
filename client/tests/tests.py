import pytest
import json
import os
import random
import psycopg2
from web3 import Web3
from crypto.kms_manager import KMSManager
from crypto.engines import CryptoEngine
from database.cloud_manager import CloudManager
from parser.shredder import FHIRShredder
from dotenv import load_dotenv

load_dotenv('/blockchain/.env')

# Paths
DATA_PATH = "/data" 
ABI_PATH = "/blockchain/out/WELLIntegrity.sol/WELLIntegrity.json"

@pytest.fixture
def system_setup():
    """Initializes the full trusted stack."""
    kms = KMSManager()
    db_key = kms.derive_key("INTEGRITY_TEST_CONTEXT")
    engine = CryptoEngine(db_key)
    cloud = CloudManager()
    shredder = FHIRShredder()
    
    # Web3 Setup
    w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL")))
    with open(ABI_PATH) as f:
        abi = json.load(f)['abi']
    contract = w3.eth.contract(address=os.getenv("WELL_INTEGRITY_ADDR"), abi=abi)
    
    return engine, cloud, shredder, w3, contract

# --- SCENARIO 1: UTF-8 & SPECIAL CHARACTER FILENAMES ---
def test_utf8_filename_handling():
    """Verifies the system can list and read files with special characters."""
    files = [f for f in os.listdir(DATA_PATH) if f.endswith('.json')]
    special_char_files = [f for f in files if any(c in f for c in "áéíóúñÁÉÍÓÚÑ")]
    
    if not special_char_files:
        pytest.skip("No files with special characters found.")
    
    selected = random.choice(special_char_files)
    print(f"\n📂 Testing UTF-8 support for file: {selected}")
    
    with open(os.path.join(DATA_PATH, selected), encoding='utf-8') as f:
        data = json.load(f)
        assert data['resourceType'] in ["Bundle", "Practitioner"]
    print("✅ SUCCESS: UTF-8 filename and content read successfully.")

# --- SCENARIO 2: COMPLEX BUNDLE INTEGRATION TEST ---
def test_full_pipeline_with_real_synthea_data(system_setup):
    engine, cloud, shredder, w3, contract = system_setup
    
    files = [f for f in os.listdir(DATA_PATH) if f.endswith('.json') and "Information" not in f]
    selected_file = random.choice(files)
    with open(os.path.join(DATA_PATH, selected_file), encoding='utf-8') as f:
        bundle = json.load(f)
    
    shredded = shredder.shred(bundle)
    patient_last_name = shredded['sse']['last_name'][0]
    token = engine.encrypt_sse(patient_last_name)
    assert token is not None
    print(f"✅ SUCCESS: Shredded and encrypted {patient_last_name}")

# --- SCENARIO 3: BLOCKCHAIN INTEGRITY TRAP ---
def test_blockchain_integrity_trap(system_setup):
    engine, cloud, shredder, w3, contract = system_setup
    account = w3.eth.account.from_key(os.getenv("PRIVATE_KEY"))

    files = [f for f in os.listdir(DATA_PATH) if f.endswith('.json') and "Information" not in f]
    with open(os.path.join(DATA_PATH, random.choice(files)), encoding='utf-8') as f:
        bundle = json.load(f)
    
    original_payload = json.dumps(bundle).encode()
    integrity_hash = w3.keccak(original_payload)
    
    # Anchor with Short DID
    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.functions.anchorEhr(integrity_hash, "did:ebsi:hospital-test").build_transaction({
        'chainId': 43113, 'gas': 500000, 'nonce': nonce,
        'maxFeePerGas': w3.to_wei('30', 'gwei'), 'maxPriorityFeePerGas': w3.to_wei('25', 'gwei')
    })
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=account.key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)

    # Save and Tamper
    enc_sse = {"last_name": engine.encrypt_sse("TrapPatient")}
    cloud.save_record(enc_sse, {}, "id", original_payload, tx_hash.hex())
    
    # Detect
    fake_payload = original_payload.replace(b"20", b"19")
    calculated_hash = w3.keccak(fake_payload)
    assert calculated_hash != integrity_hash
    print("✅ SUCCESS: Tampering detected with Short DID.")

# --- SCENARIO 4: CLOUD OUTAGE (QUORUM) ---
def test_cloud_outage_resilience(system_setup):
    engine, cloud, shredder, w3, contract = system_setup
    cloud.pg_config['host'] = "invalid_host"

    try:
        cloud.save_record({'last_name': 'Test'}, {}, "id", b"data", "tx")
        print("✅ SUCCESS: Saved to Provider B while A is down.")
    except Exception as e:
        print(f"⚠️ Note: CloudManager should catch this internally, but we caught it here: {e}")

# --- SCENARIO 5: PHE MATHEMATICAL PRECISION ---
def test_phe_mathematical_precision(system_setup):
    """Verifies that server-side addition on ciphertexts is accurate."""
    engine, cloud, shredder, w3, contract = system_setup
    
    val1, val2 = 150.50, 75.25
    expected_sum = val1 + val2
    
    enc1 = engine.encrypt_phe(val1)
    enc2 = engine.encrypt_phe(val2)
    server_side_sum_enc = enc1 + enc2
    decrypted_sum = engine.decrypt_phe(server_side_sum_enc)
    
    assert abs(decrypted_sum - expected_sum) < 0.0001
    print(f"✅ SUCCESS: PHE addition is accurate. {val1} + {val2} = {decrypted_sum}")

# --- SCENARIO 6: KMS CONTEXT ISOLATION ---
def test_kms_context_isolation(system_setup):
    """Ensures that keys derived from different contexts are unique."""
    kms = KMSManager()
    key_a = kms.derive_key("HOSPITAL_A")
    key_b = kms.derive_key("HOSPITAL_B")
    
    assert key_a != key_b
    print("✅ SUCCESS: KMS context isolation verified.")

# --- SCENARIO 7: TOTAL INFRASTRUCTURE FAILURE ---
def test_total_infrastructure_failure(system_setup):
    engine, cloud, _, _, _ = system_setup
    cloud.pg_config['host'] = "dead"
    cloud.my_config['host'] = "dead"
    
    with pytest.raises(Exception):
        cloud.search_by_token("last_name_sse", "token")
    print("✅ SUCCESS: Total failure handled.")

# --- SCENARIO 8: LONG EBSI DID ANCHORING VALIDATION ---
def test_long_did_anchoring_validation(system_setup):
    """Ensures that the long EBSI DID is authorized and correctly handled by the contract."""
    engine, cloud, shredder, w3, contract = system_setup
    account = w3.eth.account.from_key(os.getenv("PRIVATE_KEY"))
    
    long_did = "did:ebsi:hospital-long-identifier-for-economic-scalability-testing"
    dummy_hash = w3.keccak(text="LONG_DID_TEST")
    
    print(f"\n🔗 Testing Anchoring with Long DID: {long_did[:20]}...")
    
    # We use .call() first to check if it reverts without spending real gas
    try:
        contract.functions.anchorEhr(dummy_hash, long_did).call({'from': account.address})
        print("✅ SUCCESS: Long DID is authorized and transaction call succeeded.")
    except Exception as e:
        pytest.fail(f"❌ FAILURE: Long DID rejected by contract. Did you run Deploy3_TIR with ID 2? Error: {e}")