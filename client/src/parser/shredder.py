import fhirpathpy

class FHIRParser:
    def __init__(self):
        # Compile the FHIRPath expression once for efficiency
        self.family_name_path = fhirpathpy.compile(
            "Bundle.entry.resource.where(resourceType='Patient').name.family"
        )

    def extract_family_name(self, bundle):
        result = self.family_name_path(bundle)
        # Return the first family name found, or None if not found
        return result[0] if result else None