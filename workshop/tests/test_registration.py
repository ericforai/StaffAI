import unittest
import requests
import subprocess
import time
import os
import signal
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import json

class MockHQHandler(BaseHTTPRequestHandler):
    last_payload = None

    def do_POST(self):
        if self.path == '/api/workshop/register':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            MockHQHandler.last_payload = data
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"status": "success"}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return # suppress logs

class TestRegistration(unittest.TestCase):
    process = None
    mock_hq = None

    @classmethod
    def setUpClass(cls):
        # Start mock HQ server on port 3333
        cls.mock_hq = HTTPServer(('127.0.0.1', 3333), MockHQHandler)
        cls.mock_hq_thread = threading.Thread(target=cls.mock_hq.serve_forever)
        cls.mock_hq_thread.daemon = True
        cls.mock_hq_thread.start()
        
        # Start workshop
        env = os.environ.copy()
        env["HQ_API_URL"] = "http://127.0.0.1:3333/api"
        env["WORKSHOP_URL"] = "http://localhost:8001"
        env["PORT"] = "8001"
        # 确保不尝试加载 MCP 服务器，因为我们没有启动真正的 TS MCP 服务器
        env["TS_MCP_URL"] = "" 
        
        cls.process = subprocess.Popen(
            ["python3", "main.py"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        # 增加等待时间以确保异步任务执行
        time.sleep(7)

    @classmethod
    def tearDownClass(cls):
        if cls.process:
            try:
                os.killpg(os.getpgid(cls.process.pid), signal.SIGTERM)
                cls.process.wait(timeout=5)
            except:
                pass
        if cls.mock_hq:
            cls.mock_hq.shutdown()

    def test_registration_sent(self):
        self.assertIsNotNone(MockHQHandler.last_payload, "Workshop should have sent a registration payload to HQ")
        self.assertEqual(MockHQHandler.last_payload['url'], "http://localhost:8001")
        self.assertIn("deer-flow", MockHQHandler.last_payload['capabilities'])

if __name__ == "__main__":
    unittest.main()
