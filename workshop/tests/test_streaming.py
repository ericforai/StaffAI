import unittest
import requests
import subprocess
import time
import os
import signal
import json

class TestStreaming(unittest.TestCase):
    process = None

    @classmethod
    def setUpClass(cls):
        # Start workshop on port 8002
        env = os.environ.copy()
        env["PORT"] = "8002"
        # 禁用注册到 HQ 以免测试失败
        env["HQ_API_URL"] = "http://localhost:invalid"
        cls.process = subprocess.Popen(
            ["python3", "main.py"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        # 增加等待时间
        time.sleep(10)
        # 验证服务器是否启动
        try:
            requests.get("http://127.0.0.1:8002/health", timeout=2)
        except:
            print("Warning: Workshop health check failed during setup")

    @classmethod
    def tearDownClass(cls):
        if cls.process:
            try:
                # 给一点时间让进程结束
                os.killpg(os.getpgid(cls.process.pid), signal.SIGTERM)
                stdout, stderr = cls.process.communicate(timeout=5)
                print("Workshop STDOUT:", stdout.decode())
                print("Workshop STDERR:", stderr.decode())
            except:
                pass
        if cls.process:
            try:
                cls.process.wait(timeout=5)
            except:
                pass

    def test_streaming_endpoint(self):
        payload = {
            "task_id": "test_task_streaming",
            "action": "verify connection",
            "agent_role": "tester",
            "payload": {}
        }
        
        try:
            # 使用 POST 请求获取 SSE 流
            # stream=True 允许我们逐行读取响应
            response = requests.post(
                "http://127.0.0.1:8002/api/v1/tasks/stream",
                json=payload,
                stream=True,
                timeout=10
            )
            
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/event-stream", response.headers.get("Content-Type", ""))
            
            events = []
            # 读取前几行
            line_count = 0
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith("data: "):
                        data = json.loads(line_str[6:])
                        events.append(data)
                        line_count += 1
                if line_count >= 2: # 只要拿到前两个事件就证明流通了
                    break
            
            self.assertGreater(len(events), 0, "Should have received at least one event")
            # 验证 MockDeerFlowClient 的输出
            self.assertEqual(events[0]["type"], "thought")
            self.assertIn("StaffAI", events[0]["content"])
            
        except requests.exceptions.RequestException as e:
            self.fail(f"Streaming request failed: {e}")

if __name__ == "__main__":
    unittest.main()
