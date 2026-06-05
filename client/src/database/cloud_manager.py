import psycopg2
import mysql.connector
import os

class CloudManager:
    def __init__(self):
        self.pg_config = {"host": "postgres_provider", "database": "well_repo_a", "user": "postgres", "password": os.getenv("DB_PASSWORD")}
        self.my_config = {"host": "mysql_provider", "database": "well_repo_b", "user": "root", "password": os.getenv("DB_PASSWORD")}

    def save_record(self, sse_data, phe_data, blob_id, payload, tx):
        """Replicates encrypted data to Multi-Cloud providers."""
        print(f"    ☁️  Replicating data to Multi-Cloud...")
        self._write_to_db(psycopg2.connect(**self.pg_config), sse_data, phe_data, blob_id, payload, tx)
        self._write_to_db(mysql.connector.connect(**self.my_config), sse_data, phe_data, blob_id, payload, tx)
        print("    ✅ Replication successful.")

    def _write_to_db(self, conn, sse, phe, blob_id, payload, tx):
        cur = conn.cursor()
        query = """INSERT INTO ehr_records 
                   (patient_id_sse, last_name_sse, diagnosis_sse, medical_costs_phe, weight_phe, rockfs_blob_id, encrypted_payload, blockchain_tx_hash) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
        cur.execute(query, (
            sse.get('patient_id', 'None'), 
            sse.get('last_name', 'None'), 
            sse.get('diagnosis', 'None'), 
            phe.get('medical_costs', '0'),
            phe.get('weight', '0'),
            blob_id,
            payload, 
            tx
        ))
        conn.commit()
        cur.close()
        conn.close()
        
    def search_by_token(self, column_name, token):
        """Performs a secure search on the encrypted database using an SSE token."""
        conn = psycopg2.connect(**self.pg_config)
        cur = conn.cursor()
        query = f"SELECT id, blockchain_tx_hash FROM ehr_records WHERE {column_name} = %s"
        cur.execute(query, (token,))
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result