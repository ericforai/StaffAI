from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import sys
import os
import asyncio
import json
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("workshop")

# 确保 deer-flow 和相关的核心包可以被导入
base_dir = os.path.dirname(__file__)
deerflow_harness_path = os.path.join(base_dir, "deer-flow", "backend", "packages", "harness")
sys.path.append(deerflow_harness_path)

# 延迟导入 DeerFlowClient 以确保 sys.path 生效
try:
    from deerflow.client import DeerFlowClient
    from deerflow.config.extensions_config import ExtensionsConfig, McpServerConfig, set_extensions_config
    from deerflow.mcp.cache import initialize_mcp_tools
except ImportError:
    logger.error("Failed to import DeerFlow core modules. Check sys.path configuration.")
    DeerFlowClient = None

app = FastAPI(title="StaffAI Workshop", description="Python Execution Core for StaffAI")

# 配置 MCP 桥接器
async def setup_mcp_bridge():
    if not DeerFlowClient:
        return
    
    # 指向 TS 后端的 MCP SSE 接口
    ts_mcp_url = os.getenv("TS_MCP_URL", "http://localhost:3333/api/mcp/sse")
    
    config = ExtensionsConfig(
        mcp_servers={
            "staffai-office": McpServerConfig(
                enabled=True,
                type="sse",
                url=ts_mcp_url,
                description="StaffAI Office Management Core (TS Tools)"
            )
        },
        skills={}
    )
    set_extensions_config(config)
    logger.info(f"MCP Bridge configured to: {ts_mcp_url}")
    
    # 初始化并缓存 MCP 工具
    try:
        await initialize_mcp_tools()
        logger.info("MCP tools initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize MCP tools: {e}")

@app.on_event("startup")
async def startup_event():
    await setup_mcp_bridge()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TaskEnvelope(BaseModel):
    task_id: str
    action: str
    agent_role: str | None = None
    description: str | None = None
    memory_context: str | None = None
    payload: dict = {}

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Workshop execution core is running"}

@app.post("/api/v1/tasks/execute")
async def execute_task(task: TaskEnvelope):
    """
    旧的同步执行接口，保留用于兼容。
    """
    if not DeerFlowClient:
        raise HTTPException(status_code=500, detail="DeerFlow engine not initialized")
    
    try:
        client = DeerFlowClient(agent_name=task.agent_role)
        # 简单阻塞执行
        # 组合提示词
        prompt = f"任务标题: {task.action}\n描述: {task.description or ''}"
        result = client.chat(prompt)
        return {
            "task_id": task.task_id,
            "status": "success",
            "result": result
        }
    except Exception as e:
        logger.exception("Task execution failed")
        raise HTTPException(status_code=500, detail=f"Workshop execution failed: {type(e).__name__}")

@app.post("/api/v1/tasks/stream")
async def stream_task(task: TaskEnvelope, request: Request):
    """
    新的 SSE 流式执行接口。
    将 DeerFlow Agent 的内部推导过程流式回传给 TS 后端。
    """
    if not DeerFlowClient:
        raise HTTPException(status_code=500, detail="DeerFlow engine not initialized")

    async def event_generator():
        try:
            client = DeerFlowClient(agent_name=task.agent_role)
            # 开启 DeerFlow 流
            # 组合任务指令、描述和记忆上下文
            full_prompt = f"任务标题: {task.action}\n"
            if task.description:
                full_prompt += f"任务描述: {task.description}\n"
            if task.memory_context:
                full_prompt += f"历史记忆上下文:\n{task.memory_context}\n"
            
            full_prompt += "\n请开始执行上述任务。"
            
            logger.info(f"Starting stream for task {task.task_id}")
            
            for event in client.stream(full_prompt, thread_id=task.task_id):
                # 如果客户端断开，停止生成
                if await request.is_disconnected():
                    logger.info(f"Client disconnected for task {task.task_id}")
                    break

                # 映射 DeerFlow 事件到 StaffAI 协议
                yield {
                    "event": event.type,
                    "data": json.dumps({
                        "task_id": task.task_id,
                        "payload": event.data
                    })
                }
                
                # 模拟小延迟防止占满 CPU
                await asyncio.sleep(0.01)

        except Exception as e:
            logger.exception(f"Streaming failed for task {task.task_id}")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)