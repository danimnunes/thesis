import json
from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../blockchain/.env'))

# 1. Connection Settings
RPC_URL = os.getenv("RPC_URL")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not PRIVATE_KEY:
    print("❌ Error: PRIVATE_KEY not found in the .env file.")
    exit()

ACCOUNT_ADDR = w3.eth.account.from_key(PRIVATE_KEY).address
WELL_INTEGRITY_ADDR = os.getenv("WELL_INTEGRITY_ADDR")
WELL_REGISTRY_ADDR = os.getenv("WELL_REGISTRY_ADDR")
EBSI_PROXY_ADDR = os.getenv("TIMESTAMP_ADDR")

def get_abi(contract_name):
    path = f"../../blockchain/out/{contract_name}.sol/{contract_name}.json"
    with open(path, 'r') as f:
        return json.load(f)['abi']

# Connect to contracts
integrity_abi = get_abi("WELLIntegrity")
registry_abi = get_abi("WELLRegistry")
ebsi_abi = get_abi("Timestamp")

integrity = w3.eth.contract(address=WELL_INTEGRITY_ADDR, abi=integrity_abi)
registry = w3.eth.contract(address=WELL_REGISTRY_ADDR, abi=registry_abi)
ebsi_proxy = w3.eth.contract(address=EBSI_PROXY_ADDR, abi=ebsi_abi)

def run_test():
    print(f"🚀 Starting Secure Test for: {ACCOUNT_ADDR}")
    
    # Hash generation (simulating an EHR)
    ehr_hash = w3.keccak(text="Adrian111_Test_01")
    
    # build transaction
    nonce = w3.eth.get_transaction_count(ACCOUNT_ADDR)
    tx = integrity.functions.anchorEhr(ehr_hash, "did:ebsi:hospital-test").build_transaction({
        'chainId': 43113, # Avalanche Fuji Testnet chain ID
        'gas': 500000,
        'maxFeePerGas': w3.to_wei('2', 'gwei'),
        'maxPriorityFeePerGas': w3.to_wei('1', 'gwei'),
        'nonce': nonce,
    })

    # Sign transaction
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=PRIVATE_KEY)
    
    # Send transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    print(f"    Transaction sent! Hash: {tx_hash.hex()}")
    
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"    ✅ Success in block: {receipt.blockNumber}")

if __name__ == "__main__":
    run_test()