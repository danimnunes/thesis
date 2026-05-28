import fhirpathpy

class FHIRShredder:
    def __init__(self):
        # Mapping of fields to FHIRPath expressions for extraction
        self.schema_map = {
            "sse": {
                "patient_id": "Bundle.entry.resource.where(resourceType='Patient').identifier.value",
                "last_name": "Bundle.entry.resource.where(resourceType='Patient').name.family",
                "diagnosis": "Bundle.entry.resource.where(resourceType='Condition').code.coding.display"
            },
            "phe": {
                "medical_costs": "Bundle.entry.resource.where(resourceType='Claim').total.value", # costs of treatments
                "vitals": "Bundle.entry.resource.where(resourceType='Observation').valueQuantity.value" # e.g., heart rate, blood pressure
            }
        }

    def shred(self, bundle):
        extracted = {"sse": {}, "phe": {}}
        
        # SSE extraction
        for key, path in self.schema_map["sse"].items():
            res = fhirpathpy.evaluate(bundle, path)
            if res: extracted["sse"][key] = res 

        # PHE extraction
        for key, path in self.schema_map["phe"].items():
            res = fhirpathpy.evaluate(bundle, path)
            if res: extracted["phe"][key] = [float(v) for v in res if v is not None]

        return extracted