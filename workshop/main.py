from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os

# 确保 deer-flow 和相关的核心包可以被导入
# 调整 sys.path 以指向正确的目录结构
base_dir = os.path.dirname(__file__)
deerflow_harness_path = os.path.join(base_dir, "deer-flow", "backend", "packages", "harness")
sys.path.append(deerflow_harness_path)

app = FastAPI(title="StaffAI Workshop", description="Python Execution Core for StaffAI")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境下允许所有来源，生产环境建议指定端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TaskEnvelope(BaseModel):
    task_id: str
    action: str
    payload: dict = {}

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Workshop execution core is running"}

@app.post("/api/v1/tasks/execute")
def execute_task(task: TaskEnvelope):
    """
    用来验证连通性的执行端点。
    """
    try:
        # 尝试导入 deerflow，验证路径配置是否正确
        try:
            import deerflow
            has_deer_flow = True
            # 获取版本或模块路径以作验证
            deer_flow_path = deerflow.__file__
        except ImportError as e:
            has_deer_flow = False
            deer_flow_path = str(e)
            
        return {
            "task_id": task.task_id,
            "status": "success",
            "deer_flow_imported": has_deer_flow,
            "deer_flow_path": deer_flow_path,
            "result": f"Successfully received task '{task.action}'.",
            "raw_output": task.payload
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 默认运行在 8000 端口
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)