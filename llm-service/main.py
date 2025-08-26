#!/usr/bin/env python3
"""
Local LLM Service for Mock API AI
LG 엑사원 모델을 사용하여 로컬에서 AI 응답을 생성합니다.
"""

import os
import logging
from typing import List, Dict, Any, Optional
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(
    title="Local LLM Service",
    description="LG 엑사원 모델을 사용한 로컬 AI 서비스",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모델 및 토크나이저 전역 변수
model = None
tokenizer = None
model_loaded = False

# Pydantic 모델들
class ChatMessage(BaseModel):
    role: str = Field(..., description="메시지 역할 (system, user, assistant)")
    content: str = Field(..., description="메시지 내용")

class ChatCompletionRequest(BaseModel):
    model: str = Field(default="lg-exaone", description="사용할 모델명")
    messages: List[ChatMessage] = Field(..., description="대화 메시지 목록")
    max_tokens: Optional[int] = Field(default=1000, description="최대 토큰 수")
    temperature: Optional[float] = Field(default=0.7, description="창의성 조절 (0.0-1.0)")
    stream: Optional[bool] = Field(default=False, description="스트리밍 응답 여부")

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: Optional[str] = None

def load_model():
    """LG 엑사원 모델을 로드합니다."""
    global model, tokenizer, model_loaded
    
    try:
        logger.info("모델 로딩 시작...")
        
        # 모델 경로 설정 (환경변수에서 가져오거나 기본값 사용)
        model_path = os.getenv("MODEL_PATH", "/app/models/lg-exaone")
        
        if not os.path.exists(model_path):
            logger.warning(f"모델 경로 {model_path}가 존재하지 않습니다. 기본 모델을 사용합니다.")
            # 기본 모델 사용 (예: 한국어 지원 모델)
            model_path = "beomi/KoAlpaca-Polyglot-12.8B"
        
        logger.info(f"모델 로딩 중: {model_path}")
        
        # 토크나이저 로드
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # 모델 로드 (저사양 환경을 위한 설정)
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,  # 메모리 절약을 위한 half precision
            low_cpu_mem_usage=True,
            device_map="auto" if torch.cuda.is_available() else None
        )
        
        # CPU 사용 시 추가 최적화
        if not torch.cuda.is_available():
            model = model.half()  # CPU에서도 half precision 사용
        
        model_loaded = True
        logger.info("모델 로딩 완료!")
        
    except Exception as e:
        logger.error(f"모델 로딩 실패: {str(e)}")
        model_loaded = False
        raise

def generate_response(messages: List[ChatMessage], max_tokens: int = 1000, temperature: float = 0.7) -> str:
    """메시지에 대한 응답을 생성합니다."""
    if not model_loaded or model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다.")
    
    try:
        # 메시지를 프롬프트로 변환
        prompt = ""
        for msg in messages:
            if msg.role == "system":
                prompt += f"시스템: {msg.content}\n"
            elif msg.role == "user":
                prompt += f"사용자: {msg.content}\n"
            elif msg.role == "assistant":
                prompt += f"어시스턴트: {msg.content}\n"
        
        prompt += "어시스턴트: "
        
        # 토큰화
        inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True)
        
        # 추론
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_length=inputs.input_ids.shape[1] + max_tokens,
                temperature=temperature,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
                repetition_penalty=1.1
            )
        
        # 응답 디코딩
        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        return response.strip()
        
    except Exception as e:
        logger.error(f"응답 생성 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"응답 생성 중 오류가 발생했습니다: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """서비스 시작 시 모델을 로드합니다."""
    # 백그라운드에서 모델 로딩
    import threading
    thread = threading.Thread(target=load_model)
    thread.daemon = True
    thread.start()

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """서비스 상태를 확인합니다."""
    return HealthResponse(
        status="healthy",
        model_loaded=model_loaded,
        model_name="lg-exaone" if model_loaded else None
    )

@app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI API와 호환되는 채팅 완성 엔드포인트"""
    try:
        # 응답 생성
        response_text = generate_response(
            request.messages,
            request.max_tokens,
            request.temperature
        )
        
        # OpenAI API 형식에 맞춰 응답 구성
        import time
        response = ChatCompletionResponse(
            id=f"chatcmpl-{int(time.time())}",
            created=int(time.time()),
            model=request.model,
            choices=[{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            usage={
                "prompt_tokens": len(str(request.messages)),
                "completion_tokens": len(response_text),
                "total_tokens": len(str(request.messages)) + len(response_text)
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"채팅 완성 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "Local LLM Service",
        "version": "1.0.0",
        "model_loaded": model_loaded,
        "endpoints": {
            "health": "/health",
            "chat": "/v1/chat/completions"
        }
    }

if __name__ == "__main__":
    # 개발 환경에서는 자동 리로드 활성화
    reload = os.getenv("ENVIRONMENT", "production") == "development"
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload,
        log_level="info"
    ) 