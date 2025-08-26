#!/usr/bin/env python3
"""
LG 엑사원 모델 다운로드 스크립트
저사양 환경에서 사용할 수 있는 한국어 LLM 모델을 다운로드합니다.
"""

import os
import logging
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_model():
    """저사양 환경에 적합한 한국어 LLM 모델을 다운로드합니다."""
    
    # 모델 저장 경로
    model_dir = "/app/models"
    os.makedirs(model_dir, exist_ok=True)
    
    # LG 엑사원 모델이 공개되지 않은 경우를 대비한 대체 모델들
    fallback_models = [
        "beomi/KoAlpaca-Polyglot-12.8B",  # 한국어 다국어 지원, 12.8B 파라미터
        "beomi/KoAlpaca-Polyglot-5.8B",   # 더 작은 버전
        "beomi/KoAlpaca-Polyglot-1.3B",   # 가장 작은 버전
        "nlpai-lab/kullm-polyglot-12.8b-v2",  # 한국어 다국어 모델
        "EleutherAI/polyglot-ko-12.8b",   # 한국어 전용 모델
    ]
    
    # 사용 가능한 모델 찾기
    selected_model = None
    
    for model_name in fallback_models:
        try:
            logger.info(f"모델 다운로드 시도: {model_name}")
            
            # 토크나이저 다운로드
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=model_dir,
                local_files_only=False
            )
            
            # 모델 다운로드 (저사양 환경을 위한 설정)
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=model_dir,
                local_files_only=False,
                torch_dtype=torch.float16,
                low_cpu_mem_usage=True,
                device_map="auto" if torch.cuda.is_available() else None
            )
            
            # 모델을 로컬에 저장
            model_save_path = os.path.join(model_dir, "selected-model")
            tokenizer.save_pretrained(model_save_path)
            model.save_pretrained(model_save_path)
            
            selected_model = model_name
            logger.info(f"모델 다운로드 완료: {model_name}")
            logger.info(f"모델 저장 경로: {model_save_path}")
            
            # 환경변수 파일 생성
            env_file = os.path.join(model_dir, ".env")
            with open(env_file, 'w') as f:
                f.write(f"MODEL_PATH={model_save_path}\n")
                f.write(f"SELECTED_MODEL={model_name}\n")
            
            break
            
        except Exception as e:
            logger.warning(f"모델 {model_name} 다운로드 실패: {str(e)}")
            continue
    
    if selected_model is None:
        logger.error("모든 모델 다운로드에 실패했습니다.")
        # 최소한의 테스트 모델 생성
        create_test_model(model_dir)
    else:
        logger.info(f"성공적으로 다운로드된 모델: {selected_model}")

def create_test_model(model_dir):
    """테스트용 더미 모델을 생성합니다."""
    logger.info("테스트용 더미 모델 생성 중...")
    
    try:
        # 간단한 토크나이저와 모델 생성
        from transformers import PreTrainedTokenizer, PreTrainedModel
        
        # 더미 토크나이저
        class DummyTokenizer:
            def __init__(self):
                self.pad_token = "<pad>"
                self.eos_token = "</s>"
                self.pad_token_id = 0
                self.eos_token_id = 1
            
            def encode(self, text, **kwargs):
                return [ord(c) % 100 for c in text[:100]]  # 간단한 인코딩
            
            def decode(self, ids, **kwargs):
                return "".join([chr(i % 100 + 32) for i in ids if i > 0])
            
            def save_pretrained(self, path):
                os.makedirs(path, exist_ok=True)
                with open(os.path.join(path, "tokenizer_config.json"), 'w') as f:
                    f.write('{"model_type": "dummy"}')
        
        # 더미 모델
        class DummyModel:
            def __init__(self):
                self.config = type('Config', (), {'model_type': 'dummy'})()
            
            def generate(self, input_ids, **kwargs):
                # 간단한 응답 생성
                response_length = kwargs.get('max_length', 50) - input_ids.shape[1]
                dummy_response = [1] * max(0, response_length)
                return torch.tensor([input_ids[0].tolist() + dummy_response])
            
            def save_pretrained(self, path):
                os.makedirs(path, exist_ok=True)
                with open(os.path.join(path, "config.json"), 'w') as f:
                    f.write('{"model_type": "dummy"}')
        
        # 더미 모델 저장
        test_model_path = os.path.join(model_dir, "test-model")
        tokenizer = DummyTokenizer()
        model = DummyModel()
        
        tokenizer.save_pretrained(test_model_path)
        model.save_pretrained(test_model_path)
        
        # 환경변수 파일 생성
        env_file = os.path.join(model_dir, ".env")
        with open(env_file, 'w') as f:
            f.write(f"MODEL_PATH={test_model_path}\n")
            f.write("SELECTED_MODEL=test-dummy-model\n")
        
        logger.info(f"테스트 모델 생성 완료: {test_model_path}")
        
    except Exception as e:
        logger.error(f"테스트 모델 생성 실패: {str(e)}")

if __name__ == "__main__":
    download_model() 