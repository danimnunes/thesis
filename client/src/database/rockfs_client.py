import os
import uuid

class RockFSClient:
    def __init__(self):
        self.mount_point = "/mnt/rockfs"

    def save_blob(self, binary_data, extension=".dat"):
        """
        Save binary data to RockFS. The RockFS client is expected to be running and mounted at /mnt/rockfs.
        The file is written to the mount point, and RockFS handles the underlying storage in the Cloud-of-Clouds.
        """
        # 1. Generate a unique file name
        file_id = f"{uuid.uuid4()}{extension}"
        file_path = os.path.join(self.mount_point, file_id)

        # 2. Save the file (RockFS intercepts and sends to MinIO)
        try:
            with open(file_path, "wb") as f:
                f.write(binary_data)
            print(f"    📦 RockFS: File {file_id} stored in Cloud-of-Clouds.")
            return file_id
        except Exception as e:
            print(f"    ❌ RockFS Error: {e}")
            return None