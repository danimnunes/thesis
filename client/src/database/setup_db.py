import psycopg2
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv('/blockchain/.env') 

def setup_db():
    db_password = os.getenv('DB_PASSWORD', 'password')

    # SQL query for both DBs
    create_table_query = """
        CREATE TABLE IF NOT EXISTS ehr_records (
            id SERIAL PRIMARY KEY,
            patient_id_sse TEXT,      
            last_name_sse TEXT,       
            diagnosis_sse TEXT,       
            medical_costs_phe TEXT,   
            weight_phe TEXT,          
            rockfs_blob_id TEXT,      
            encrypted_payload BYTEA,  
            blockchain_tx_hash TEXT,  
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """
    
    # 1. PostgreSQL (Provider A)
    print("🛠  Configuring Provider A (PostgreSQL)...")
    try:
        conn = psycopg2.connect(
            host="postgres_provider", 
            database="well_repo_a", 
            user="postgres", 
            password=db_password
        )
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS ehr_records;")
        cur.execute(create_table_query)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ PostgreSQL configured.")
    except Exception as e:
        print(f"❌ PostgreSQL error: {e}")

    # 2. MySQL (Provider B)
    print("🛠  Configuring Provider B (MySQL)...")
    try:
        conn = mysql.connector.connect(
            host="mysql_provider", 
            database="well_repo_b", 
            user="root", 
            password=db_password
        )
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS ehr_records;")
        mysql_query = create_table_query.replace("SERIAL", "INT AUTO_INCREMENT").replace("BYTEA", "LONGBLOB")
        cur.execute(mysql_query)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ MySQL configured.")
    except Exception as e:
        print(f"❌ MySQL error: {e}")

if __name__ == "__main__":
    setup_db()