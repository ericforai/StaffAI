import unittest
import requests
import subprocess
import time
import os
import signal

class TestHealth(unittest.TestCase):
    process = None

    @classmethod
    def setUpClass(cls):
        # Start the server
        # We run it from the workshop directory
        cls.process = subprocess.Popen(
            ["python3", "main.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
        # Wait for server to start
        time.sleep(5)

    @classmethod
    def tearDownClass(cls):
        # Stop the server
        if cls.process:
            try:
                os.killpg(os.getpgid(cls.process.pid), signal.SIGTERM)
                cls.process.wait(timeout=5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                pass

    def test_health_endpoint(self):
        try:
            response = requests.get("http://127.0.0.1:8000/health", timeout=5)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"status": "ok", "message": "Workshop execution core is running"})
        except requests.exceptions.ConnectionError:
            self.fail("Could not connect to the workshop server")

if __name__ == "__main__":
    unittest.main()
