#!/usr/bin/env python3
"""
Local LLM Service for Mock API AI
EXAONE 4.0 1.2B 기반 로컬 AI 응답 서비스
- 비스트리밍: OpenAI Chat Completions JSON
- 스트리밍: OpenAI SSE(chat.completion.chunk)
- CPU 동적 양자화: 안전 모드(레이어-단위) + 실패 시 폴백
"""

import os
import time
import json
import gc
import logging
import threading
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

import torch
import torch.nn as nn
import torch.nn.quantized.dynamic as nnqd
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TextIteratorStreamer,
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict
import uvicorn

# -----------------------
# 로깅
# -----------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local-llm")

# -----------------------
# 환경변수
# -----------------------
DEFAULT_MODEL = os.getenv("MODEL_PATH", "LGAI-EXAONE/EXAONE-4.0-1.2B")
ENABLE_DYNAMIC_INT8 = os.getenv("ENABLE_DYNAMIC_INT8", "1") == "1"  # CPU int8 시도 여부
SAFE_QUANT = os.getenv("SAFE_QUANT", "1") == "1"                    # 안전 모드(레이어-단위) 사용 여부
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")

# -----------------------
# Pydantic 베이스(보호 네임스페이스 경고 제거)
# -----------------------
class BaseSchema(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

# -----------------------
# 스키마
# -----------------------
class ChatMessage(BaseSchema):
    role: str = Field(..., description="메시지 역할 (system, user, assistant)")
    content: str = Field(..., description="메시지 내용")

class ChatCompletionRequest(BaseSchema):
    model: str = Field(default="lg-exaone", description="사용할 모델명(라벨)")
    messages: List[ChatMessage] = Field(..., description="대화 메시지 목록")
    max_tokens: Optional[int] = Field(default=512, description="최대 생성 토큰 수")
    temperature: Optional[float] = Field(default=0.7, description="창의성 (0.0-1.0)")
    stream: Optional[bool] = Field(default=False, description="스트리밍 응답 여부")

class ChatCompletionResponse(BaseSchema):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]

class HealthResponse(BaseSchema):
    status: str
    model_loaded: bool
    model_name: Optional[str] = None

# -----------------------
# 전역 상태
# -----------------------
app: FastAPI  # lifespan에서 초기화
model = None
tokenizer = None
model_loaded = False
model_max_length = 4096

# -----------------------
# CPU 스레드 고정
# -----------------------
_THREADS_SET = False
def _set_cpu_threads():
    global _THREADS_SET
    if _THREADS_SET:
        return
    try:
        n = max(1, os.cpu_count() or 1)
        os.environ.setdefault("OMP_NUM_THREADS", str(n))
        os.environ.setdefault("MKL_NUM_THREADS", str(n))
        torch.set_num_threads(n)
        logger.info(f"CPU threads set to {n}")
    except Exception as e:
        logger.warning(f"Thread setting skipped: {e}")
    _THREADS_SET = True

_set_cpu_threads()

# -----------------------
# 메모리/양자화 보조 유틸
# -----------------------
def _estimate_model_bytes(m: nn.Module) -> int:
    """모델 파라미터/버퍼 기준 대략적 바이트 수 추정"""
    total = 0
    for p in m.parameters(recurse=True):
        total += p.numel() * p.element_size()
    for b in m.buffers(recurse=True):
        total += b.numel() * b.element_size()
    return total

def _available_memory_bytes() -> Optional[int]:
    try:
        import psutil
        return int(psutil.virtual_memory().available)
    except Exception:
        return None  # psutil 없으면 스킵

def _count_quant_linear(m: nn.Module) -> int:
    return sum(1 for _n, mod in m.named_modules() if isinstance(mod, nnqd.Linear))

def _safe_dynamic_quantize_linear_inplace(m: nn.Module):
    """
    레이어-단위(in-place) 동적 양자화로 피크 메모리 사용량을 줄임.
    Linear 모듈만 qint8로 교체.
    """
    for name, child in list(m.named_children()):
        if isinstance(child, nn.Linear):
            try:
                q_child = torch.quantization.quantize_dynamic(child, {nn.Linear}, dtype=torch.qint8)
                setattr(m, name, q_child)
                del child
                gc.collect()
            except Exception as e:
                logger.warning(f"[SAFE_QUANT] {name} 양자화 실패: {e}")
        else:
            _safe_dynamic_quantize_linear_inplace(child)

# -----------------------
# 공통 유틸
# -----------------------
def _ensure_system_message(msgs: List[Dict[str, str]]) -> List[Dict[str, str]]:
    if any(m.get("role") == "system" for m in msgs):
        return msgs
    return [{"role": "system", "content": "한국어로 간결하고 정확하게 답변하세요."}] + msgs

def _build_input_ids(messages: List[Dict[str, str]], include_system: bool = True):
    msgs = [dict(role=m["role"], content=m["content"]) for m in messages]
    if include_system:
        msgs = _ensure_system_message(msgs)
    input_ids = tokenizer.apply_chat_template(
        msgs,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt"
    )
    return input_ids

def _build_input_ids_for_stream(messages: List[Dict[str, str]]):
    """스트림 모드용: 시스템 메시지 포함하여 입력 생성하되, 출력에서는 제외"""
    msgs = [dict(role=m["role"], content=m["content"]) for m in messages]
    msgs = _ensure_system_message(msgs)
    input_ids = tokenizer.apply_chat_template(
        msgs,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt"
    )
    return input_ids, len(msgs) - 1  # 시스템 메시지 개수 반환

# -----------------------
# 모델 로드 (안전 양자화 포함)
# -----------------------
def load_model():
    global model, tokenizer, model_loaded, model_max_length
    logger.info("모델 로딩 시작...")

    model_path = DEFAULT_MODEL

    # 토크나이저: fast 우선, 실패 시 slow
    try:
        tokenizer_local = AutoTokenizer.from_pretrained(
            model_path, trust_remote_code=True, use_fast=True
        )
        logger.info("Fast tokenizer 사용")
    except Exception as e:
        logger.warning(f"Fast tokenizer 실패: {e} → slow tokenizer로 폴백")
        tokenizer_local = AutoTokenizer.from_pretrained(
            model_path, trust_remote_code=True, use_fast=False
        )

    if tokenizer_local.pad_token is None:
        tokenizer_local.pad_token = tokenizer_local.eos_token

    raw_max_len = getattr(tokenizer_local, "model_max_length", 4096)
    max_len = max(2048, min(4096, raw_max_len))
    logger.info(f"model_max_length = {max_len}")

    # 모델 로드
    if torch.cuda.is_available():
        logger.info("GPU: bfloat16 + device_map=auto")
        model_local = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            low_cpu_mem_usage=True,
            device_map="auto",
        )
    else:
        logger.info("CPU: float32")
        model_local = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
            attn_implementation="eager"
        ).float()

        # CPU 동적 양자화 (옵션)
        if ENABLE_DYNAMIC_INT8:
            logger.info("CPU 동적 양자화(int8) 준비...")
            try:
                # 엔진 지정(x86: fbgemm, ARM: qnnpack)
                try:
                    torch.backends.quantized.engine = "fbgemm"
                    logger.info(f"quantized.engine = {torch.backends.quantized.engine}")
                except Exception as e:
                    logger.warning(f"quantized.engine 설정 무시: {e}")

                # 메모리 여유 확인 (psutil 있으면)
                avail = _available_memory_bytes()
                if avail is not None:
                    est_bytes = _estimate_model_bytes(model_local)
                    # 대략 1.2~1.5배 여유 권장(레이어 교체 중 일시 오버헤드)
                    if avail < int(est_bytes * 1.2):
                        logger.warning(
                            f"가용 메모리 부족으로 양자화 스킵 (avail={avail:,}B, est_model={est_bytes:,}B)"
                        )
                    else:
                        tq0 = time.time()
                        if SAFE_QUANT:
                            logger.info("SAFE_QUANT=1 → 레이어-단위(in-place) 양자화 시작")
                            _safe_dynamic_quantize_linear_inplace(model_local)
                        else:
                            logger.info("SAFE_QUANT=0 → 모델 단위 양자화 시작")
                            model_local = torch.quantization.quantize_dynamic(
                                model_local, {nn.Linear}, dtype=torch.qint8
                            )
                        gc.collect()
                        tq1 = time.time()
                        q_count = _count_quant_linear(model_local)
                        logger.info(
                            f"동적 양자화 적용 완료: q_linear={q_count}, 소요={tq1 - tq0:.2f}s"
                        )
                        if q_count == 0:
                            logger.warning("양자화된 Linear 레이어가 0개입니다. 모델 구조상 미적용일 수 있습니다.")
                else:
                    # psutil 없음: 바로 시도
                    tqs = time.time()
                    if SAFE_QUANT:
                        logger.info("SAFE_QUANT=1(psutil 미사용) → 레이어-단위 양자화 시작")
                        _safe_dynamic_quantize_linear_inplace(model_local)
                    else:
                        logger.info("SAFE_QUANT=0(psutil 미사용) → 모델 단위 양자화 시작")
                        model_local = torch.quantization.quantize_dynamic(
                            model_local, {nn.Linear}, dtype=torch.qint8
                        )
                    gc.collect()
                    tqe = time.time()
                    q_count = _count_quant_linear(model_local)
                    logger.info(
                        f"동적 양자화 적용 완료: q_linear={q_count}, 소요={tqe - tqs:.2f}s"
                    )
                    if q_count == 0:
                        logger.warning("양자화된 Linear 레이어가 0개입니다. 모델 구조상 미적용일 수 있습니다.")

            except Exception as e:
                logger.warning(f"동적 양자화 실패, float32로 계속 진행: {e}")

    model_local.eval()

    # 전역 반영
    globals()["tokenizer"] = tokenizer_local
    globals()["model"] = model_local
    globals()["model_max_length"] = max_len
    globals()["model_loaded"] = True
    logger.info("모델 로딩 완료.")

# -----------------------
# 생성 유틸
# -----------------------
def _gen_kwargs(max_tokens: int, temperature: float):
    return dict(
        max_new_tokens=max_tokens,
        temperature=temperature,
        do_sample=True,
        top_p=0.95,
        top_k=50,
        repetition_penalty=1.1,
        no_repeat_ngram_size=3,
        pad_token_id=tokenizer.pad_token_id,
        eos_token_id=tokenizer.eos_token_id,
        use_cache=True,
    )

def generate_response(messages: List[Dict[str, str]], max_tokens: int = 512, temperature: float = 0.7) -> Dict[str, Any]:
    if not model_loaded or model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다.")

    input_ids = _build_input_ids(messages, include_system=True)
    input_len = int(input_ids.shape[1])

    t0 = time.time()
    with torch.inference_mode():
        outputs = model.generate(
            input_ids.to(model.device),
            **_gen_kwargs(max_tokens, temperature)
        )
    t1 = time.time()

    new_tokens = int(outputs.shape[1] - input_len)
    text = tokenizer.decode(outputs[0, input_len:], skip_special_tokens=True).strip()

    logger.info(f"[non-stream] 입력토큰={input_len}, 출력토큰={new_tokens}, 소요={t1 - t0:.2f}s")

    # usage 계산(가벼운 방식)
    completion_ids = tokenizer(text, add_special_tokens=False, return_tensors="pt")["input_ids"]
    completion_tokens = int(completion_ids.shape[1])
    prompt_tokens = input_len
    total_tokens = prompt_tokens + completion_tokens

    return {
        "text": text or "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens
        }
    }

def sse_stream_response(request: ChatCompletionRequest):
    created = int(time.time())
    stream_id = f"chatcmpl-{created}"

    messages = [m.model_dump() for m in request.messages]
    
    # 시스템 메시지가 포함된 전체 입력 생성
    msgs_with_system = [dict(role=m["role"], content=m["content"]) for m in messages]
    msgs_with_system = _ensure_system_message(msgs_with_system)
    
    # 전체 입력 (시스템 메시지 포함)
    input_ids_full = tokenizer.apply_chat_template(
        msgs_with_system,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt"
    )
    
    # 사용자 입력만 (시스템 메시지 제외) - 프롬프트 길이 계산용
    msgs_user_only = [dict(role=m["role"], content=m["content"]) for m in messages]
    input_ids_user = tokenizer.apply_chat_template(
        msgs_user_only,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt"
    )
    
    # 프롬프트 길이 계산 (시스템 메시지 + 사용자 입력)
    prompt_length = int(input_ids_user.shape[1])
    
    logger.info(f"[stream] 전체입력토큰={input_ids_full.shape[1]}, 프롬프트토큰={prompt_length}")

    streamer = TextIteratorStreamer(tokenizer, skip_special_tokens=True)

    def _worker():
        with torch.inference_mode():
            model.generate(
                input_ids=input_ids_full.to(model.device),
                **_gen_kwargs(request.max_tokens, request.temperature),
                streamer=streamer,
            )

    threading.Thread(target=_worker, daemon=True).start()

    def _sse_event(obj: Dict[str, Any]) -> bytes:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")

    # 프롬프트 부분을 건너뛰고 실제 생성된 응답만 스트리밍
    token_count = 0
    for piece in streamer:
        token_count += 1
        
        # 프롬프트 길이만큼 건너뛰기
        if token_count <= prompt_length:
            continue
            
        # 실제 AI 응답 부분만 스트리밍
        chunk = {
            "id": stream_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": request.model,
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": piece},
                    "finish_reason": None
                }
            ]
        }
        yield _sse_event(chunk)

    done = {
        "id": stream_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": request.model,
        "choices": [
            {
                "index": 0,
                "delta": {},
                "finish_reason": "stop"
            }
        ]
    }
    yield _sse_event(done)
    yield b"data: [DONE]\n\n"

# -----------------------
# lifespan
# -----------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        load_model()
        yield
    finally:
        pass

# -----------------------
# FastAPI 앱
# -----------------------
app = FastAPI(
    title="Local LLM Service",
    description="LG EXAONE 4.0 1.2B 로컬 AI 서비스",
    version="1.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# -----------------------
# 라우트
# -----------------------
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        model_loaded=model_loaded,
        model_name="lg-exaone" if model_loaded else None
    )

@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(request: ChatCompletionRequest):
    """
    OpenAI Chat Completions 호환
    - stream=false → JSON 단일
    - stream=true  → SSE 스트리밍
    """
    try:
        if request.stream:
            return StreamingResponse(
                sse_stream_response(request),
                media_type="text/event-stream; charset=utf-8"
            )

        out = generate_response(
            [m.model_dump() for m in request.messages],
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )

        created = int(time.time())
        return ChatCompletionResponse(
            id=f"chatcmpl-{created}",
            created=created,
            model=request.model,
            choices=[{
                "index": 0,
                "message": {"role": "assistant", "content": out["text"]},
                "finish_reason": "stop"
            }],
            usage=out["usage"]
        )
    except Exception as e:
        logger.error(f"채팅 완성 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "message": "Local LLM Service",
        "version": "1.3.0",
        "model_loaded": model_loaded,
        "endpoints": {"health": "/health", "chat": "/v1/chat/completions"}
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=(ENVIRONMENT == "development"),
        log_level="info",
        workers=1,   # 반복 부팅 방지: 단일 워커 권장
    )
