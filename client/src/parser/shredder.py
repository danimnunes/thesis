import fhirpathpy

class FHIRShredder:
    def __init__(self):
        self.schema_map = {
            "sse": {
                "patient_id": "Bundle.entry.resource.where(resourceType='Patient').identifier.where(system='https://github.com/synthetichealth/synthea').value",
                
                "last_name": "Bundle.entry.resource.where(resourceType='Patient').name.where(use='official').family",
                
                "diagnosis": "Bundle.entry.resource.where(resourceType='Condition').code.coding.display"
            },
            "phe": {
                "medical_costs": "Bundle.entry.resource.where(resourceType='Claim').total.value",
                
                "weight": "Bundle.entry.resource.where(resourceType='Observation').where(code.coding.code='29463-7').valueQuantity.value"
            }
        }

    def shred(self, bundle):
        extracted = {"sse": {}, "phe": {}}
        
        for key, path in self.schema_map["sse"].items():
            res = fhirpathpy.evaluate(bundle, path)
            if res:
                if key in ['patient_id', 'last_name']:
                    extracted["sse"][key] = [res[0]] 
                else:
                    extracted["sse"][key] = list(set(res))

        for key, path in self.schema_map["phe"].items():
            res = fhirpathpy.evaluate(bundle, path)
            if res:
                extracted["phe"][key] = [float(v) for v in res if v is not None]
            else:
                extracted["phe"][key] = [0.0]

        return extracted