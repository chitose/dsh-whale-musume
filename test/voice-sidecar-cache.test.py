import importlib.util
import os
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("voice_sidecar", Path(__file__).parents[1] / "lib" / "voice-sidecar.py")
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)


class VoiceCacheTest(unittest.TestCase):
    def test_oldest_audio_is_removed_and_names_are_localized(self):
        with tempfile.TemporaryDirectory() as directory:
            voice.cache_dir = Path(directory)
            voice.MAX_CACHE_BYTES = 12
            for index, letter in enumerate("abc"):
                file = voice.cache_dir / (letter * 64 + ".wav")
                file.write_bytes(b"RIFFxx")
                os.utime(file, (index + 1, index + 1))
            voice.prune_cache()
            self.assertFalse((voice.cache_dir / ("a" * 64 + ".wav")).exists())
            self.assertTrue((voice.cache_dir / ("b" * 64 + ".wav")).exists())
            self.assertTrue((voice.cache_dir / ("c" * 64 + ".wav")).exists())
        voice.translations = {"Hello, Master!": "こんにちは、マスター！"}
        self.assertEqual(voice.localized("Hello, Master!", "ja", "先生", "くじらちゃん"), "こんにちは、先生！")


if __name__ == "__main__":
    unittest.main()
