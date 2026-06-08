import json
import os
import random
import time
import csv
import psycopg2
from web3 import Web3
from crypto.kms_manager import KMSManager
from crypto.engines import CryptoEngine
from database.cloud_manager import CloudManager
from parser.shredder import FHIRShredder
from dotenv import load_dotenv

load_dotenv('/blockchain/.env')
RESULTS_FILE = "evaluation_results.csv"
DATA_PATH = "/data"
ITERATIONS = 10

class Evaluator:
    def __init__(self):
        self.kms = KMSManager()
        self.shredder = FHIRShredder()
        self.cloud = CloudManager()
        self.db_key = self.kms.derive_key("EVALUATION_KEY")
        self.engine = CryptoEngine(self.db_key)
        self.w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL")))
        
        with open("/blockchain/out/WELLIntegrity.sol/WELLIntegrity.json") as f:
            abi = json.load(f)['abi']
        self.contract = self.w3.eth.contract(address=os.getenv("WELL_INTEGRITY_ADDR"), abi=abi)
        self.priv_key = os.getenv("PRIVATE_KEY")
        self.account = self.w3.eth.account.from_key(self.priv_key)

    def run_ingestion_benchmarks(self, file_path, group, writer):
        """Measures Ingestion Latency and Gas (Metrics 1 & 2)."""
        with open(file_path, encoding='utf-8') as f:
            bundle = json.load(f)
        
        for i in range(1, ITERATIONS + 1):
            # --- 1. WELL Ingestion ---
            start = time.perf_counter()
            
            # Shredding
            shredded = self.shredder.shred(bundle)
            
            # SSE Encryption (Measuring full list)
            diag_tokens = [self.engine.encrypt_sse(d) for d in shredded['sse']['diagnosis']]
            enc_sse = {
                "patient_id": self.engine.encrypt_sse(shredded['sse']['patient_id'][0]), 
                "last_name": self.engine.encrypt_sse(shredded['sse']['last_name'][0]),
                "diagnosis": "|".join(diag_tokens)
            }
            
            # PHE Encryption
            enc_phe = {
                "medical_costs": str(self.engine.encrypt_phe(100.0).ciphertext()), 
                "weight": str(self.engine.encrypt_phe(70.0).ciphertext())
            }
            
            if i <= 5:
                test_did = "did:ebsi:hospital-test" # 23 chars
                mode_label = "WELL_ShortDID"
            else:
                test_did = "did:ebsi:hospital-long-identifier-for-economic-scalability-testing" # 66 chars
                mode_label = "WELL_LongDID"
            
            # Blockchain Anchor
            integrity_hash = self.w3.keccak(hexstr=enc_sse['patient_id'])
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            tx = self.contract.functions.anchorEhr(integrity_hash, test_did).build_transaction({
                'chainId': 43113, 'gas': 500000, 'nonce': nonce,
                'maxFeePerGas': self.w3.to_wei('30', 'gwei'), 
                'maxPriorityFeePerGas': self.w3.to_wei('25', 'gwei')
            })
            signed = self.w3.eth.account.sign_transaction(tx, self.priv_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Persistence
            self.cloud.save_record(enc_sse, enc_phe, "well_id", b"payload", tx_hash.hex())
            
            latency = time.perf_counter() - start
            writer.writerow({'Type': 'Ingestion', 'Mode': mode_label, 'Group': group, 'Iteration': i, 'Latency_Sec': latency, 'GasUsed': receipt.gasUsed})
            print(f"    {group} {i}/{ITERATIONS} - Gas: {receipt.gasUsed} - DID: {mode_label}", end='\r')
            time.sleep(0.5)

    def run_query_benchmarks(self, writer):
        """Metric 3: Search and PHE Performance."""
        print("\n🔎 Running Query & Analytics Benchmarks...")
        name = "Bogisich202"
        token = self.engine.encrypt_sse(name)
        val1, val2 = 100.0, 50.0
        enc1 = self.engine.encrypt_phe(val1)

        for i in range(1, ITERATIONS + 1):
            # --- Search Latency ---
            start = time.perf_counter()
            self.cloud.search_by_token("last_name_sse", name) 
            writer.writerow({'Type': 'Search', 'Mode': 'Baseline', 'Group': 'N/A', 'Iteration': i, 'Latency_Sec': time.perf_counter() - start, 'GasUsed': 0})
            
            start = time.perf_counter()
            self.cloud.search_by_token("last_name_sse", token)
            writer.writerow({'Type': 'Search', 'Mode': 'WELL_SSE', 'Group': 'N/A', 'Iteration': i, 'Latency_Sec': time.perf_counter() - start, 'GasUsed': 0})

            # --- PHE Processing ---
            start = time.perf_counter()
            _ = val1 + val2
            writer.writerow({'Type': 'Analytics', 'Mode': 'Baseline', 'Group': 'N/A', 'Iteration': i, 'Latency_Sec': time.perf_counter() - start, 'GasUsed': 0})

            start = time.perf_counter()
            _ = enc1 + val2 
            writer.writerow({'Type': 'Analytics', 'Mode': 'WELL_PHE', 'Group': 'N/A', 'Iteration': i, 'Latency_Sec': time.perf_counter() - start, 'GasUsed': 0})

def run_full_evaluation():
    evaluator = Evaluator()
    print("🔍 Categorizing Synthea files...")
    all_files = [f for f in os.listdir(DATA_PATH) if f.endswith('.json') and "Information" not in f]
    buckets = {"Small": [], "Medium": [], "Large": []}
    for f in all_files:
        with open(os.path.join(DATA_PATH, f), 'r', encoding='utf-8') as file:
            line_count = sum(1 for _ in file)
        if line_count < 1000: buckets["Small"].append(f)
        elif 1000 <= line_count < 10000: buckets["Medium"].append(f)
        else: buckets["Large"].append(f)

    selected_files = {k: random.choice(v) for k, v in buckets.items() if v}

    with open(RESULTS_FILE, mode='w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=['Type', 'Mode', 'Group', 'Iteration', 'Latency_Sec', 'GasUsed'])
        writer.writeheader()
        
        print("\n" + "="*60)
        print("🚀 STARTING OFFICIAL WELL REPOSITORY PERFORMANCE EVALUATION")
        print("="*60)

        for group, filename in selected_files.items():
            print(f"📊 Benchmarking Ingestion: {group} (File: {filename})")
            evaluator.run_ingestion_benchmarks(os.path.join(DATA_PATH, filename), group, writer)
            print(f"\n    Category {group} Done.")
        
        evaluator.run_query_benchmarks(writer)

    print(f"\n✅ Evaluation Complete. Results exported to {RESULTS_FILE}")

if __name__ == "__main__":
    run_full_evaluation()