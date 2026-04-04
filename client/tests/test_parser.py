import pytest
import json
import os
from src.parser.shredder import FHIRParser

def test_patient_name_extraction():
    parser = FHIRParser()
    data_dir = '/data'
    
    # List the JSON files in the data directory
    files = [f for f in os.listdir(data_dir) if f.endswith('.json')]
    assert len(files) > 0, "There is no JSON file in the data directory!"

    # Open the first JSON file and load its content
    with open(os.path.join(data_dir, files[0]), 'r') as f:
        data = json.load(f)
    
    family_name = parser.extract_family_name(data)
    
    # Assertions to verify the correctness of the extracted family name
    assert family_name is not None
    assert isinstance(family_name, str)
    print(f"\n[TEST] Family name extracted successfully: {family_name}")