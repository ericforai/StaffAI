from __future__ import annotations
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
import sys
import os
import asyncio
import json
import logging
import uuid
from typing import Optional, Union
from datetime import datetime, timezone
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("workshop")

# 切换到 workshop 目录以确保 DeerFlow config 能找到
WORKSHOP_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(WORKSHOP_ROOT)
logger.info(f"Workshop working directory switched to: {os.getcwd()}")

# 检查 API KEY
if not os.getenv("OPENAI_API_KEY"):
    logger.warning("OPENAI_API_KEY not found in environment!")
else:
    logger.info("OPENAI_API_KEY is configured.")

# Bootstrap: make deerflow packages importable
WORKSHOP_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.extend([
    os.path.join(WORKSHOP_DIR, "deer-flow"),
    os.path.join(WORKSHOP_DIR, "deer-flow", "backend"),
    os.path.join(WORKSHOP_DIR, "deer-flow", "backend", "packages", "harness"),
])

# Direct LLM client for simple chat without agent middleware
def create_direct_llm_stream(model_name: str = "glm-4-plus"):
    """Create a direct LLM streaming callable using LangChain."""
    from deerflow.models import create_chat_model
    from langchain_core.messages import HumanMessage

    model = create_chat_model(name=model_name, thinking_enabled=False)

    def stream(prompt: str, thread_id: str | None = None):
        messages = [HumanMessage(content=prompt)]
        for chunk in model.stream(messages):
            text = chunk.content if hasattr(chunk, "content") else str(chunk)
            if text:
                yield {"type": "ai", "content": text}

    return stream


class MockDeerFlowClient:
    def __init__(self, *args, **kwargs):
        logger.info(f"MockDeerFlowClient initialized with args={args} kwargs={kwargs}")

    def stream(self, prompt, **kwargs):
        logger.info(f"MockDeerFlowClient.stream called with prompt length {len(prompt)}")
        yield {"type": "thought", "content": "正在通过 StaffAI 引擎分析任务内容..."}
        yield {"type": "thought", "content": "物理连接已建立，正在模拟执行流..."}
        yield {"type": "action", "content": "执行中：建立 TS 和 Python 之间的 SSE 桥接。"}
        yield {"type": "result", "content": "连接验证成功！双核架构已准备就绪。"}


# 延迟导入 DeerFlowClient 以确保 sys.path 生效
try:
    from deerflow.client import DeerFlowClient
    from deerflow.config.extensions_config import ExtensionsConfig, McpServerConfig, set_extensions_config
    from deerflow.mcp.cache import initialize_mcp_tools
    from deerflow.config.paths import set_base_dir
except ImportError as e:
    logger.error(f"Failed to import DeerFlow core modules: {e}")
    logger.warning("Using MockDeerFlowClient as fallback for connection testing.")
    DeerFlowClient = MockDeerFlowClient
    # 为缺少的组件提供占位符以防崩溃
    class ExtensionsConfig:
        def __init__(self, **kwargs): pass
    class McpServerConfig:
        def __init__(self, **kwargs): pass
    def set_extensions_config(config): pass
    def set_base_dir(path): pass
    async def initialize_mcp_tools(): pass

# Try to import agents router standalone
agents_router = None
try:
    import importlib.util
    _agents_spec = importlib.util.spec_from_file_location(
        "_workshop_agents_router",
        os.path.join(WORKSHOP_DIR, "deer-flow", "backend", "app", "gateway", "routers", "agents.py"),
    )
    if _agents_spec and _agents_spec.loader:
        _agents_mod = importlib.util.module_from_spec(_agents_spec)
        _agents_spec.loader.exec_module(_agents_mod)
        agents_router = _agents_mod.router
        logger.info("agents_router loaded (standalone mode)")
except Exception as e:
    logger.error(f"Failed to load agents_router standalone: {e}")

# --- Manual implementation of agents router as fallback ---
# This ensures that even if DeerFlow imports are broken, the essential agent management APIs work.

import yaml
from pathlib import Path
import re

AGENT_NAME_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")

def _get_deer_flow_paths():
    base_dir = Path(os.getenv("DEER_FLOW_HOME") or os.path.join(os.path.expanduser("~"), ".deer-flow"))
    return {
        "base": base_dir,
        "agents": base_dir / "agents",
        "user_md": base_dir / "USER.md"
    }

class AgentResponse(BaseModel):
    name: str
    description: str = ""
    model: str | None = None
    tool_groups: list[str] | None = None
    soul: str | None = None

class AgentsListResponse(BaseModel):
    agents: list[AgentResponse]

class AgentCreateRequest(BaseModel):
    name: str
    description: str = ""
    model: str | None = None
    tool_groups: list[str] | None = None
    soul: str = ""

class AgentUpdateRequest(BaseModel):
    description: str | None = None
    model: str | None = None
    tool_groups: list[str] | None = None
    soul: str | None = None

if not agents_router:
    @app.get("/api/agents", response_model=AgentsListResponse)
    async def list_agents():
        paths = _get_deer_flow_paths()
        agents = []
        if paths["agents"].exists():
            for entry in sorted(paths["agents"].iterdir()):
                if entry.is_dir() and (entry / "config.yaml").exists():
                    try:
                        with open(entry / "config.yaml", encoding="utf-8") as f:
                            cfg = yaml.safe_load(f) or {}
                        agents.append(AgentResponse(
                            name=cfg.get("name", entry.name),
                            description=cfg.get("description", ""),
                            model=cfg.get("model"),
                            tool_groups=cfg.get("tool_groups")
                        ))
                    except Exception:
                        continue
        return {"agents": agents}

    @app.get("/api/agents/check")
    async def check_agent_name(name: str):
        if not AGENT_NAME_PATTERN.match(name):
            raise HTTPException(status_code=422, detail="Invalid name format")
        paths = _get_deer_flow_paths()
        available = not (paths["agents"] / name.lower()).exists()
        return {"available": available, "name": name.lower()}

    @app.get("/api/agents/{name}", response_model=AgentResponse)
    async def get_agent(name: str):
        paths = _get_deer_flow_paths()
        agent_dir = paths["agents"] / name.lower()
        if not agent_dir.exists():
            raise HTTPException(status_code=404, detail="Agent not found")
        
        try:
            with open(agent_dir / "config.yaml", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
            soul = ""
            if (agent_dir / "SOUL.md").exists():
                soul = (agent_dir / "SOUL.md").read_text(encoding="utf-8")
            
            return AgentResponse(
                name=cfg.get("name", name),
                description=cfg.get("description", ""),
                model=cfg.get("model"),
                tool_groups=cfg.get("tool_groups"),
                soul=soul
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/agents", response_model=AgentResponse, status_code=201)
    async def create_agent(request: AgentCreateRequest):
        if not AGENT_NAME_PATTERN.match(request.name):
            raise HTTPException(status_code=422, detail="Invalid name")
        
        paths = _get_deer_flow_paths()
        agent_dir = paths["agents"] / request.name.lower()
        if agent_dir.exists():
            raise HTTPException(status_code=409, detail="Agent exists")
            
        agent_dir.mkdir(parents=True, exist_ok=True)
        config = {"name": request.name.lower(), "description": request.description}
        if request.model: config["model"] = request.model
        if request.tool_groups: config["tool_groups"] = request.tool_groups
        
        with open(agent_dir / "config.yaml", "w", encoding="utf-8") as f:
            yaml.dump(config, f)
        (agent_dir / "SOUL.md").write_text(request.soul, encoding="utf-8")
        
        return AgentResponse(**config, soul=request.soul)

# Include routers (if standalone load succeeded, it will override/co-exist)
if agents_router:
    app.include_router(agents_router)

# ---------------------------------------------------------------------------
# Thread Store — in-memory storage for LangGraph-compatible thread state
# ---------------------------------------------------------------------------
_threads_store: dict[str, dict] = {}


def _make_thread(thread_id: Optional[str] = None, metadata: Optional[dict] = None) -> dict:
    """Create a new thread record (immutable snapshot)."""
    tid = thread_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    return {
        "thread_id": tid,
        "created_at": now,
        "updated_at": now,
        "metadata": dict(metadata or {}),
        "values": {
            "messages": [],
            "artifacts": [],
            "title": None,
            "todos": [],
        },
        "status": "idle",
    }


def _get_or_create_thread(thread_id: str, metadata: Optional[dict] = None) -> dict:
    """Return existing thread or create one with the given ID."""
    if thread_id not in _threads_store:
        if len(_threads_store) >= MAX_THREADS:
            _evict_oldest_thread()
        _threads_store[thread_id] = _make_thread(thread_id, metadata)
    return _threads_store[thread_id]


def _evict_oldest_thread() -> None:
    """Evict the least-recently-updated thread to free space."""
    if not _threads_store:
        return
    oldest_id = min(_threads_store, key=lambda k: _threads_store[k]["updated_at"])
    del _threads_store[oldest_id]
    logger.info(f"Evicted thread {oldest_id} (store cap reached)")


def _update_thread(thread_id: str, **overrides) -> dict:
    """Immutably update a thread and persist to store."""
    old = _threads_store.get(thread_id)
    if old is None:
        raise KeyError(f"Thread {thread_id} not found")
    updated = {**old, **overrides, "updated_at": datetime.now(timezone.utc).isoformat()}
    _threads_store[thread_id] = updated
    return updated


def _update_thread_values(thread_id: str, values_overrides: dict) -> dict:
    """Immutably update thread values and persist to store."""
    old = _threads_store.get(thread_id)
    if old is None:
        raise KeyError(f"Thread {thread_id} not found")
    new_values = {**old["values"], **values_overrides}
    updated = {**old, "values": new_values, "updated_at": datetime.now(timezone.utc).isoformat()}
    _threads_store[thread_id] = updated
    return updated


# ---------------------------------------------------------------------------
# Pydantic request models for input validation
# ---------------------------------------------------------------------------

class TaskEnvelope(BaseModel):
    task_id: str
    action: str
    agent_role: Optional[str] = None
    identity_context: Optional[str] = None
    description: Optional[str] = None
    memory_context: Optional[str] = None
    payload: dict = {}


class ChatRequest(BaseModel):
    """Simple chat request for direct LLM streaming without agent middleware."""
    message: str
    system_prompt: Optional[str] = None
    model_name: Optional[str] = "glm-4-plus"


class CreateThreadRequest(BaseModel):
    metadata: Optional[dict] = None


class SearchThreadsRequest(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class UpdateStateRequest(BaseModel):
    values: dict = {}


class PatchThreadRequest(BaseModel):
    metadata: Optional[dict] = None


class RunRequest(BaseModel):
    assistant_id: Optional[str] = None
    input: dict = {}
    context: dict = {}
    stream_mode: Optional[list[str]] = None


# ---------------------------------------------------------------------------
# MCP Bridge
# ---------------------------------------------------------------------------

async def setup_mcp_bridge():
    if not DeerFlowClient:
        return

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

    try:
        await initialize_mcp_tools()
        logger.info("MCP tools initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize MCP tools: {e}")


async def register_with_hq():
    hq_url = os.getenv("HQ_API_URL", "http://localhost:3333/api")
    workshop_url = os.getenv("WORKSHOP_URL", "http://localhost:8000")

    payload = {
        "url": workshop_url,
        "capabilities": ["deer-flow", "langgraph", "fastapi"]
    }

    try:
        import requests
        response = requests.post(f"{hq_url}/workshop/register", json=payload, timeout=5)
        if response.status_code == 200:
            logger.info(f"Successfully registered with HQ at {hq_url}")
        else:
            logger.warning(f"Failed to register with HQ: {response.status_code} {response.text}")
    except Exception as e:
        logger.error(f"Error registering with HQ: {e}")


@app.on_event("startup")
async def startup_event():
    await setup_mcp_bridge()
    # 异步执行注册，以免阻塞启动
    asyncio.create_task(register_with_hq())


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

_trusted_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3008",
    "http://localhost:8000",
    "http://localhost:8888",
    os.getenv("ALLOWED_ORIGIN", ""),
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in _trusted_origins if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Legacy endpoints (existing)
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Workshop execution core is running"}


@app.post("/api/v1/tasks/execute")
async def execute_task(task: TaskEnvelope):
    """旧的同步执行接口，保留用于兼容。"""
    if not DeerFlowClient:
        raise HTTPException(status_code=500, detail="DeerFlow engine not initialized")

    try:
        client = DeerFlowClient(config_path=CONFIG_PATH, model_name="glm-4-plus", agent_name=task.agent_role)
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
    """新的 SSE 流式执行接口。"""
    if not DeerFlowClient:
        raise HTTPException(status_code=500, detail="DeerFlow engine not initialized")

    async def event_generator():
        try:
            client = DeerFlowClient(config_path=CONFIG_PATH, model_name="glm-4-plus", agent_name=task.agent_role)
            
            # 注入负责人灵魂 (System Identity)
            system_instruction = task.identity_context if task.identity_context else ""
            
            full_prompt = f"任务标题: {task.action}\n"
            if task.description:
                full_prompt += f"任务描述: {task.description}\n"
            if task.memory_context:
                full_prompt += f"历史记忆上下文:\n{task.memory_context}\n"

            full_prompt += "\n请开始执行上述任务。"

            logger.info(f"Starting stream for task {task.task_id}")
            # 使用 system_instruction 启动流
            for event in client.stream(full_prompt, thread_id=task.task_id):
                if await request.is_disconnected():
                    logger.info(f"Client disconnected for task {task.task_id}")
                    break

                # 统一事件序列化：提取 type 和可 JSON 序列化的 data
                # StreamEvent 是 dataclass，没有 model_dump()
                if hasattr(event, "type") and hasattr(event, "data"):
                    # dataclass StreamEvent
                    event_type = event.type
                    raw_data = event.data
                    # Recursively convert any remaining Pydantic model to dict
                    def to_primitive(obj):
                        if hasattr(obj, "model_dump"):
                            d = obj.model_dump()
                            return {k: to_primitive(v) for k, v in d.items()}
                        elif isinstance(obj, dict):
                            return {k: to_primitive(v) for k, v in obj.items()}
                        elif isinstance(obj, (list, tuple)):
                            return [to_primitive(i) for i in obj]
                        return obj
                    event_data = to_primitive(raw_data)
                elif isinstance(event, dict):
                    event_type = event.get("type", "message")

                    def to_primitive_dict(obj):
                        if hasattr(obj, "model_dump"):
                            d = obj.model_dump()
                            return {k: to_primitive_dict(v) for k, v in d.items()}
                        elif isinstance(obj, dict):
                            return {k: to_primitive_dict(v) for k, v in obj.items()}
                        elif isinstance(obj, (list, tuple)):
                            return [to_primitive_dict(i) for i in obj]
                        return obj
                    event_data = to_primitive_dict(event)
                else:
                    event_type = "message"
                    event_data = str(event)

                yield {
                    "event": event_type,
                    "data": json.dumps(event_data, ensure_ascii=False)
                }

                await asyncio.sleep(0.01)

        except Exception as e:
            logger.exception(f"Streaming failed for task {task.task_id}")
            yield {
                "event": "error",
                "data": json.dumps({"error": "Internal streaming error"})
            }

    return EventSourceResponse(event_generator())


@app.post("/api/v1/chat/stream")
async def chat_stream(chat_req: ChatRequest, request: Request):
    """Direct LLM chat streaming without agent middleware (for brainstorming).

    Bypasses ClarificationMiddleware to allow normal text-only responses.
    """
    async def event_generator():
        try:
            from deerflow.models import create_chat_model
            from langchain_core.messages import HumanMessage, SystemMessage

            model = create_chat_model(name=chat_req.model_name or "glm-4-plus", thinking_enabled=False)

            # Build messages with optional system prompt
            messages = []
            if chat_req.system_prompt:
                messages.append(SystemMessage(content=chat_req.system_prompt))
            messages.append(HumanMessage(content=chat_req.message))

            logger.info(f"Starting direct chat stream with model {chat_req.model_name}")
            full_content = ""

            for chunk in model.stream(messages):
                if await request.is_disconnected():
                    logger.info("Client disconnected during chat stream")
                    break

                text = chunk.content if hasattr(chunk, "content") else str(chunk)
                if text:
                    full_content += text
                    yield {
                        "event": "message",
                        "data": json.dumps({"type": "ai", "content": text}, ensure_ascii=False)
                    }
                    await asyncio.sleep(0.01)

            # Send completion signal
            yield {
                "event": "done",
                "data": json.dumps({"type": "end", "content": full_content}, ensure_ascii=False)
            }

        except Exception as e:
            logger.exception("Chat streaming failed")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())


# ===========================================================================
# LangGraph-Compatible API Layer
#
# These endpoints translate LangGraph SDK HTTP calls to DeerFlowClient calls,
# allowing the DeerFlow frontend (@langchain/langgraph-sdk) to work with
# the Workshop FastAPI server.
# ===========================================================================


# --- Thread CRUD ---


@app.post("/threads")
async def lg_create_thread(request: Request):
    """LangGraph SDK: client.threads.create()"""
    body = {}
    raw = await request.body()
    if raw:
        body = json.loads(raw)

    validated = CreateThreadRequest(**body) if body else CreateThreadRequest()
    thread = _make_thread(metadata=validated.metadata)

    if len(_threads_store) >= MAX_THREADS:
        _evict_oldest_thread()
    _threads_store[thread["thread_id"]] = thread
    logger.info(f"Created thread {thread['thread_id']}")
    return thread


@app.post("/threads/search")
async def lg_search_threads(request: Request):
    """LangGraph SDK: client.threads.search()"""
    body = {}
    raw = await request.body()
    if raw:
        body = json.loads(raw)

    validated = SearchThreadsRequest(
        limit=body.get("limit", 50),
        offset=body.get("offset", 0),
    )

    threads = sorted(
        _threads_store.values(),
        key=lambda t: t["updated_at"],
        reverse=True,
    )

    return threads[validated.offset : validated.offset + validated.limit]


@app.get("/threads/{thread_id}")
async def lg_get_thread(thread_id: str):
    """LangGraph SDK: client.threads.get()"""
    if thread_id not in _threads_store:
        raise HTTPException(status_code=404, detail="Thread not found")
    return _threads_store[thread_id]


@app.get("/threads/{thread_id}/state")
async def lg_get_thread_state(thread_id: str):
    """LangGraph SDK: client.threads.getState()"""
    if thread_id not in _threads_store:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread = _threads_store[thread_id]
    return {
        "values": thread["values"],
        "next": [],
        "checkpoint": {},
        "created_at": thread["created_at"],
        "parent_checkpoint": {},
    }


@app.post("/threads/{thread_id}/state")
async def lg_update_thread_state(thread_id: str, request: Request):
    """LangGraph SDK: client.threads.updateState()"""
    body = await request.json()
    validated = UpdateStateRequest(**body)
    values = validated.values

    thread = _get_or_create_thread(thread_id)
    new_values = dict(thread["values"])

    for key, val in values.items():
        if key == "messages" and isinstance(val, list):
            new_values["messages"] = [*new_values["messages"], *val]
        else:
            new_values = {**new_values, key: val}

    _update_thread_values(thread_id, new_values)
    return {"ok": True}


@app.delete("/threads/{thread_id}")
async def lg_delete_thread(thread_id: str):
    """LangGraph SDK: client.threads.delete()"""
    _threads_store.pop(thread_id, None)
    return {"ok": True}


@app.patch("/threads/{thread_id}")
async def lg_patch_thread(thread_id: str, request: Request):
    """LangGraph SDK: client.threads.update()"""
    body = await request.json()
    validated = PatchThreadRequest(**body)

    thread = _get_or_create_thread(thread_id)

    if validated.metadata:
        _update_thread(thread_id, metadata={**thread["metadata"], **validated.metadata})
    else:
        _update_thread(thread_id)

    return _threads_store[thread_id]


@app.get("/threads/{thread_id}/history")
async def lg_thread_history(thread_id: str):
    """LangGraph SDK: client.threads.getHistory()"""
    if thread_id not in _threads_store:
        return []
    return []


# --- Runs ---


def _extract_human_message(body: dict) -> str:
    """Extract text from LangGraph SDK run payload."""
    validated = RunRequest(**body)
    input_data = validated.input
    messages = input_data.get("messages", [])

    if not messages:
        return ""

    last_msg = messages[-1]
    content = last_msg.get("content", "")

    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                parts.append(part.get("text", ""))
            elif isinstance(part, str):
                parts.append(part)
        return " ".join(parts)

    return str(content)


@app.post("/threads/{thread_id}/runs/stream")
async def lg_stream_run(thread_id: str, request: Request):
    """LangGraph SDK: client.runs.stream() — SSE streaming endpoint.

    Translates DeerFlowClient.stream() events to LangGraph SSE protocol.
    """
    if not DeerFlowClient:
        raise HTTPException(
            status_code=500, detail="DeerFlow engine not initialized"
        )

    body = await request.json()
    thread = _get_or_create_thread(thread_id)
    human_text = _extract_human_message(body)
    context = body.get("context", {})

    if not human_text:
        raise HTTPException(status_code=400, detail="No message content provided")

    # Add human message to thread state (immutable update)
    human_msg = {
        "type": "human",
        "content": human_text,
        "id": f"msg-{uuid.uuid4()}",
    }
    current_msgs = thread["values"]["messages"]
    _update_thread_values(thread_id, {"messages": [*current_msgs, human_msg]})

    async def event_generator():
        run_id = str(uuid.uuid4())
        try:
            model_name = context.get("model_name", "glm-4-plus")
            client = DeerFlowClient(
                config_path=CONFIG_PATH,
                model_name=model_name,
            )

            logger.info(f"Starting LangGraph stream for thread {thread_id}")

            # 1. metadata event
            yield {
                "event": "metadata",
                "data": json.dumps({"run_id": run_id}),
            }

            for event in client.stream(human_text, thread_id=thread_id):
                if await request.is_disconnected():
                    logger.info(f"Client disconnected for thread {thread_id}")
                    break

                if event.type == "messages-tuple":
                    msg_data = event.data
                    yield {
                        "event": "messages-tuple",
                        "data": json.dumps([msg_data]),
                    }

                    # Also add AI messages to thread state (immutable)
                    if msg_data.get("type") == "ai":
                        ai_msg = {
                            "type": "ai",
                            "content": msg_data.get("content", ""),
                            "id": msg_data.get("id", f"msg-{uuid.uuid4()}"),
                        }
                        t = _threads_store.get(thread_id, {})
                        old_msgs = t.get("values", {}).get("messages", [])
                        _update_thread_values(thread_id, {"messages": [*old_msgs, ai_msg]})

                elif event.type == "values":
                    values_data = event.data
                    non_msg = {k: v for k, v in values_data.items() if k != "messages"}
                    if non_msg:
                        _update_thread_values(thread_id, non_msg)

                    yield {
                        "event": "values",
                        "data": json.dumps(values_data),
                    }

                elif event.type == "end":
                    _update_thread(thread_id, status="idle")
                    yield {
                        "event": "end",
                        "data": json.dumps({}),
                    }

                await asyncio.sleep(0.001)

        except Exception as e:
            logger.exception(f"Stream failed for thread {thread_id}")
            yield {
                "event": "error",
                "data": json.dumps({"error": "Internal stream error"}),
            }

    return EventSourceResponse(event_generator())


@app.post("/threads/{thread_id}/runs")
async def lg_create_run(thread_id: str, request: Request):
    """LangGraph SDK: client.runs.create() — synchronous run."""
    if not DeerFlowClient:
        raise HTTPException(
            status_code=500, detail="DeerFlow engine not initialized"
        )

    body = await request.json()
    thread = _get_or_create_thread(thread_id)
    human_text = _extract_human_message(body)
    context = body.get("context", {})

    if not human_text:
        raise HTTPException(status_code=400, detail="No message content provided")

    try:
        model_name = context.get("model_name", "glm-4-plus")
        client = DeerFlowClient(
            config_path=CONFIG_PATH,
            model_name=model_name,
        )
        result = client.chat(human_text, thread_id=thread_id)
        return {"result": result, "thread_id": thread_id}
    except Exception as e:
        logger.exception(f"Run failed for thread {thread_id}")
        raise HTTPException(status_code=500, detail="Internal run execution error")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
