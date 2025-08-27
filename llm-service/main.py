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
model_max_length = 4096  # 기본 최대 길이를 4096으로 증가

# Pydantic 모델들
class ChatMessage(BaseModel):
    role: str = Field(..., description="메시지 역할 (system, user, assistant)")
    content: str = Field(..., description="메시지 내용")

class ChatCompletionRequest(BaseModel):
    model: str = Field(default="lg-exaone", description="사용할 모델명")
    messages: List[ChatMessage] = Field(..., description="대화 메시지 목록")
    max_tokens: Optional[int] = Field(default=3072, description="최대 토큰 수 (권장: 2048~4096)")
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
        model_path = os.getenv("MODEL_PATH", "LGAI-EXAONE/EXAONE-4.0-1.2B")
        
        # LGAI-EXAONE 모델들을 우선적으로 시도 (Transformers 호환 모델만)
        model_candidates = [
            "LGAI-EXAONE/EXAONE-4.0-1.2B",       # 1순위: 작은 모델 (빠른 로딩)
            "LGAI-EXAONE/EXAONE-4.0-32B",        # 2순위: 큰 모델 (높은 품질)
            "beomi/KoAlpaca-Polyglot-12.8B"      # 3순위: 폴백 모델
        ]
        
        # 환경변수에서 지정된 모델이 있으면 우선 사용
        if model_path and model_path != "/app/models/selected-model":
            model_candidates.insert(0, model_path)
        
        # 모델 로딩 시도
        model_loaded_successfully = False
        for candidate in model_candidates:
            try:
                logger.info(f"모델 로딩 시도 중: {candidate}")
                model_path = candidate
                # 실제로 모델이 존재하는지 확인
                logger.info(f"모델 {candidate} 확인 중...")
                # 더 안전한 방법으로 모델 존재 여부 확인
                test_tokenizer = AutoTokenizer.from_pretrained(
                    candidate, 
                    trust_remote_code=True,
                    use_fast=False,  # 느리지만 더 안정적인 토크나이저 사용
                    local_files_only=False  # 로컬 파일만 사용하지 않음
                )
                logger.info(f"모델 {candidate} 확인 완료, 이 모델을 사용합니다.")
                break
            except Exception as e:
                logger.warning(f"모델 {candidate} 확인 실패, 다음 모델 시도: {str(e)}")
                continue
        
        logger.info(f"모델 로딩 중: {model_path}")
        logger.info("토크나이저 로딩 시작...")
        
        # 토크나이저 로드
        tokenizer = AutoTokenizer.from_pretrained(
            model_path,
            trust_remote_code=True,
            use_fast=False
        )
        
        # 토크나이저 설정
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # 모델의 최대 길이 설정
        global model_max_length
        if hasattr(tokenizer, 'model_max_length'):
            # 토크나이저의 최대 길이를 2048~4096 범위로 조정
            raw_max_length = tokenizer.model_max_length
            if raw_max_length > 1000000:  # 100만 이상이면 비정상
                model_max_length = 4096  # 더 큰 기본값 사용
                logger.warning(f"토크나이저 최대 길이가 비정상적으로 큽니다: {raw_max_length}, 기본값 {model_max_length}로 설정")
            elif raw_max_length < 2048:
                model_max_length = 2048  # 최소값 보장
            elif raw_max_length > 4096:
                model_max_length = 4096  # 최대값 제한
            else:
                model_max_length = raw_max_length
        else:
            model_max_length = 4096  # 기본값을 4096으로 증가
        
        logger.info(f"토크나이저 최대 길이: {model_max_length}")
        
        logger.info("토크나이저 로딩 완료")
        logger.info("모델 로딩 시작...")
        
        # 모델 로드 (EXAONE 4.0 공식 문서 기반)
        if torch.cuda.is_available():
            logger.info("GPU 환경에서 bfloat16으로 모델 로딩...")
            # GPU 환경에서는 bfloat16 사용 (EXAONE 4.0 권장)
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype=torch.bfloat16,
                low_cpu_mem_usage=True,
                device_map="auto"
            )
        else:
            logger.info("CPU 환경에서 float32로 모델 로딩...")
            # CPU 환경에서는 float32 사용 (호환성)
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True,
                # CPU에서 float16 관련 문제 방지
                attn_implementation="eager"
            )
            # CPU에서 모델을 float32로 강제 변환
            model = model.float()
        
        logger.info("모델 로딩 완료!")
        model_loaded = True
        logger.info("모델 로딩 완료! 서비스 준비 완료!")
        
    except Exception as e:
        logger.error(f"모델 로딩 실패: {str(e)}")
        model_loaded = False
        raise

def generate_response(messages: List[ChatMessage], max_tokens: int = 1000, temperature: float = 0.7) -> str:
    """메시지에 대한 응답을 생성합니다."""
    if not model_loaded or model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다.")
    
    try:
        # CPU 환경에서 float16 관련 문제 방지
        if not torch.cuda.is_available():
            # CPU에서 모델을 float32로 강제 변환
            model.float()
        
        # 메시지를 프롬프트로 변환 (EXAONE 모델에 맞는 형식)
        prompt = ""
        for msg in messages:
            if msg.role == "system":
                prompt += f"<|im_start|>system\n{msg.content}<|im_end|>\n"
            elif msg.role == "user":
                prompt += f"<|im_start|>user\n{msg.content}<|im_end|>\n"
            elif msg.role == "assistant":
                prompt += f"<|im_start|>assistant\n{msg.content}<|im_end|>\n"
        
        # 간단하고 명확한 프롬프트
        prompt += "<|im_start|>assistant\n"
        
        # 토큰화 (최대 길이 설정 포함) - 체계적인 토큰 관리
        # 1단계: 모델의 max_position_embeddings 확인
        if hasattr(model.config, 'max_position_embeddings'):
            model_max_pos = model.config.max_position_embeddings
        else:
            model_max_pos = 65536  # 기본값 64K
        
        # 2단계: 서비스 상한 설정 (8,192 토큰)
        service_limit = 8192
        
        # 3단계: 권장 범위 설정 (2,048~4,096 토큰)
        recommended_min = 2048
        recommended_max = 4096
        
        # 4단계: 실제 사용할 최대 길이 계산
        effective_max_length = min(
            min(model_max_length, model_max_pos, service_limit),
            recommended_max
        )
        
        # 5단계: 최소 길이 보장
        effective_max_length = max(effective_max_length, recommended_min)
        
        logger.info(f"토큰 제한 설정: 모델={model_max_length}, 모델최대={model_max_pos}, 서비스상한={service_limit}, 최종={effective_max_length}")
        
        inputs = tokenizer(
            prompt, 
            return_tensors="pt", 
            padding=True, 
            truncation=True,
            max_length=effective_max_length
        )
        
        # 추론
        with torch.no_grad():
            # 입력 길이 + 요청된 최대 토큰 수를 초과하지 않도록 제한
            max_generate_length = min(
                inputs.input_ids.shape[1] + max_tokens,
                effective_max_length
            )
            
            # 토큰 길이 검증 및 로깅
            input_tokens = inputs.input_ids.shape[1]
            max_output_tokens = max_generate_length - input_tokens
            
            logger.info(f"토큰 생성 설정: 입력={input_tokens}, 최대출력={max_output_tokens}, 총최대={max_generate_length}")
            
            # 입력이 너무 길면 경고
            if input_tokens > effective_max_length * 0.8:
                logger.warning(f"입력 토큰이 너무 깁니다: {input_tokens}/{effective_max_length}")
            
            outputs = model.generate(
                inputs.input_ids,
                max_length=max_generate_length,
                temperature=temperature,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
                repetition_penalty=1.1,  # 기본값으로 복원
                num_return_sequences=1,
                # EXAONE 모델에 최적화된 파라미터
                top_p=0.9,   # 더 안정적인 토큰 선택
                top_k=50,    # 적당한 토큰 고려
                no_repeat_ngram_size=3,  # 반복 방지 강화
                min_length=inputs.input_ids.shape[1] + 20,  # 최소 응답 길이 조정
                early_stopping=False     # 더 긴 응답 허용
            )
        
        # 응답 디코딩
        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        
        # 응답 정리 및 검증
        response = response.strip()
        
        # 특수 토큰 및 이상한 문자 제거
        response = response.replace("<|im_start|>", "").replace("<|im_end|>", "")
        response = response.replace("</think>", "").replace("<|end_im|>", "")
        response = response.replace(">>>", "").replace("```", "")
        
        # 응답이 비어있거나 너무 짧으면 기본 응답 생성
        if not response or len(response) < 5:
            logger.warning("모델 응답이 비어있거나 너무 짧습니다. 기본 응답을 생성합니다.")
            response = "안녕하세요! 무엇을 도와드릴까요?"
        
        # 응답 길이 로깅
        logger.info(f"생성된 응답 길이: {len(response)} 자")
        logger.info(f"응답 내용 미리보기: {response[:100]}...")
        
        return response
        
    except Exception as e:
        logger.error(f"응답 생성 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"응답 생성 중 오류가 발생했습니다: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """서비스 시작 시 모델을 로드합니다."""
    # 메인 스레드에서 모델 로딩 시작 (백그라운드 스레드 대신)
    try:
        load_model()
    except Exception as e:
        logger.error(f"시작 시 모델 로딩 실패: {str(e)}")
        # 모델 로딩 실패해도 서비스는 계속 실행

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
                "prompt_tokens": len(tokenizer.encode(str(request.messages))),
                "completion_tokens": len(tokenizer.encode(response_text)),
                "total_tokens": len(tokenizer.encode(str(request.messages))) + len(tokenizer.encode(response_text))
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