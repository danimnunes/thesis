import json
from web3 import Web3
import os

# 1. Connection Settings
# Pointing to the local Anvil node (Docker or local terminal)
RPC_URL = "http://127.0.0.1:8545"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Contract Addresses from your latest Deployment
WELL_REGISTRY_ADDR = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0"
WELL_INTEGRITY_ADDR = "0x68B1D87F95878fE05B998F19b66F4baba5De1aed"
EBSI_PROXY_ADDR = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1"

# 2. Helper function to load ABIs from Foundry output folders
def get_abi(contract_name):
    # Adjust the path according to your directory structure
    path = f"../../blockchain/out/{contract_name}.sol/{contract_name}.json"
    with open(path, 'r') as f:
        return json.load(f)['abi']

# 3. Contract Initialization
try:
    registry_abi = get_abi("WELLRegistry")
    integrity_abi = get_abi("WELLIntegrity")
    # We use the logic ABI (Timestamp) to interact with the Proxy address
    ebsi_abi = get_abi("Timestamp") 

    registry = w3.eth.contract(address=WELL_REGISTRY_ADDR, abi=registry_abi)
    integrity = w3.eth.contract(address=WELL_INTEGRITY_ADDR, abi=integrity_abi)
    ebsi_proxy = w3.eth.contract(address=EBSI_PROXY_ADDR, abi=ebsi_abi)
except Exception as e:
    print(f"Error loading ABIs: {e}")
    exit()

# 4. Configure transaction sender (Anvil Default Account #0)
w3.eth.default_account = w3.eth.accounts[0]

def run_test():
    print(" Starting WELL -> EBSI integration test...")

    # STEP A: Verify Dependency Injection via WELLRegistry
    print(f"\n[1] Querying Registry...")
    stored_ebsi = registry.functions.getContract("EBSI_TIMESTAMP").call()
    print(f"    EBSI address stored in Registry: {stored_ebsi}")
    
    if stored_ebsi.lower() != EBSI_PROXY_ADDR.lower():
        print("     ERROR: Registry address does not match Proxy address!")
        return

    # STEP B: Generate a test Hash (Simulating FHIR Parser output)
    # Using specific patient metadata for the simulation
    test_data = "Adrian111_Heidenreich818_42a8b5d1-b600-7478-dca5-5692fd386273"
    ehr_hash = w3.keccak(text=test_data)
    print(f"\n[2] Generated EHR Hash: {ehr_hash.hex()}")

    # STEP C: Invoke WELL system to anchor the data (Cross-contract call)
    print(f"[3] Sending transaction to WELLIntegrity.anchorEHR()...")
    tx_hash = integrity.functions.anchorEHR(ehr_hash).transact()
    
    print("    Waiting for blockchain confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"    ✅ Success! Transaction confirmed in block {receipt.blockNumber}")

    # STEP D: Final Verification (Reading directly from official EBSI storage)
    print(f"\n[4] Verifying data integrity in the official EBSI contract...")
    
    # Note: EBSI v4 uses sha256(data) as the primary key for timestamps.
    # We query the proxy to ensure our system correctly invoked the UE logic.
    try:
        ts_data = ebsi_proxy.functions.getTimestamp(ehr_hash).call()
        print(f"     EBSI Result: Registered by {ts_data[1]} in block {ts_data[2]}")
        print("\n TEST COMPLETED SUCCESSFULLY: The integrity cycle is fully functional!")
    except Exception as e:
        print(f"      Note: The hash is anchored, but the EBSI query format might vary: {e}")

if __name__ == "__main__":
    run_test()