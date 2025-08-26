#!/usr/bin/env python3
"""
테스트용 간단한 모델 생성 스크립트
저사양 환경에서 테스트할 수 있는 가벼운 모델을 생성합니다.
"""

import os
import json
import torch
import torch.nn as nn
from transformers import PreTrainedTokenizer, PreTrainedModel

class SimpleTokenizer:
    """간단한 토크나이저 구현"""
    
    def __init__(self):
        self.pad_token = "<pad>"
        self.eos_token = "</s>"
        self.pad_token_id = 0
        self.eos_token_id = 1
        self.vocab_size = 1000
        
        # 간단한 단어-인덱스 매핑
        self.word2id = {self.pad_token: 0, self.eos_token: 1}
        self.id2word = {0: self.pad_token, 1: self.eos_token}
        
        # 기본 한국어 단어들 추가
        basic_words = [
            "API", "생성", "데이터", "응답", "요청", "필드", "타입", "JSON",
            "OpenAPI", "스펙", "경로", "메서드", "GET", "POST", "PUT", "DELETE",
            "성공", "오류", "검증", "설명", "예제", "값", "문자열", "숫자",
            "불린", "배열", "객체", "필수", "선택", "기본값", "형식", "구조"
        ]
        
        for i, word in enumerate(basic_words, 2):
            self.word2id[word] = i
            self.id2word[i] = word
    
    def encode(self, text, **kwargs):
        """텍스트를 토큰 ID로 변환"""
        words = text.split()
        ids = []
        for word in words:
            if word in self.word2id:
                ids.append(self.word2id[word])
            else:
                # 알 수 없는 단어는 해시 기반으로 ID 생성
                hash_id = hash(word) % 100 + 100
                ids.append(hash_id)
        return ids
    
    def decode(self, ids, **kwargs):
        """토큰 ID를 텍스트로 변환"""
        words = []
        for token_id in ids:
            if token_id in self.id2word:
                words.append(self.id2word[token_id])
            else:
                words.append(f"<unk_{token_id}>")
        return " ".join(words)
    
    def save_pretrained(self, path):
        """토크나이저를 저장"""
        os.makedirs(path, exist_ok=True)
        
        # 토크나이저 설정 저장
        config = {
            "model_type": "simple",
            "pad_token": self.pad_token,
            "eos_token": self.eos_token,
            "vocab_size": self.vocab_size
        }
        
        with open(os.path.join(path, "tokenizer_config.json"), 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        # 어휘 저장
        vocab = {word: idx for word, idx in self.word2id.items()}
        with open(os.path.join(path, "vocab.json"), 'w', encoding='utf-8') as f:
            json.dump(vocab, f, ensure_ascii=False, indent=2)

class SimpleModel(nn.Module):
    """간단한 언어 모델 구현"""
    
    def __init__(self, vocab_size=1000, hidden_size=128, num_layers=2):
        super().__init__()
        self.vocab_size = vocab_size
        self.hidden_size = hidden_size
        
        # 임베딩 레이어
        self.embedding = nn.Embedding(vocab_size, hidden_size)
        
        # LSTM 레이어
        self.lstm = nn.LSTM(hidden_size, hidden_size, num_layers, batch_first=True)
        
        # 출력 레이어
        self.output = nn.Linear(hidden_size, vocab_size)
        
        # 드롭아웃
        self.dropout = nn.Dropout(0.1)
    
    def forward(self, input_ids, **kwargs):
        # 임베딩
        embedded = self.embedding(input_ids)
        
        # LSTM 처리
        lstm_out, _ = self.lstm(embedded)
        
        # 드롭아웃 적용
        lstm_out = self.dropout(lstm_out)
        
        # 출력
        logits = self.output(lstm_out)
        
        return logits
    
    def generate(self, input_ids, max_length=50, temperature=0.7, **kwargs):
        """텍스트 생성"""
        batch_size = input_ids.shape[0]
        current_ids = input_ids.clone()
        
        for _ in range(max_length - input_ids.shape[1]):
            # 예측
            with torch.no_grad():
                outputs = self.forward(current_ids)
                next_token_logits = outputs[:, -1, :] / temperature
                
                # 다음 토큰 선택
                next_token = torch.multinomial(torch.softmax(next_token_logits, dim=-1), 1)
                
                # ID 추가
                current_ids = torch.cat([current_ids, next_token], dim=1)
                
                # EOS 토큰이면 중단
                if (next_token == 1).any():  # EOS 토큰 ID
                    break
        
        return current_ids
    
    def save_pretrained(self, path):
        """모델을 저장"""
        os.makedirs(path, exist_ok=True)
        
        # 모델 설정 저장
        config = {
            "model_type": "simple",
            "vocab_size": self.vocab_size,
            "hidden_size": self.hidden_size,
            "num_layers": 2
        }
        
        with open(os.path.join(path, "config.json"), 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        # 모델 가중치 저장
        torch.save(self.state_dict(), os.path.join(path, "pytorch_model.bin"))

def create_test_model():
    """테스트용 모델 생성"""
    print("🧪 테스트용 간단한 모델 생성 중...")
    
    # 모델 저장 경로
    model_dir = "/app/models"
    os.makedirs(model_dir, exist_ok=True)
    
    # 테스트 모델 경로
    test_model_path = os.path.join(model_dir, "test-model")
    
    try:
        # 토크나이저 생성
        print("📝 토크나이저 생성 중...")
        tokenizer = SimpleTokenizer()
        tokenizer.save_pretrained(test_model_path)
        
        # 모델 생성
        print("🤖 모델 생성 중...")
        model = SimpleModel()
        model.save_pretrained(test_model_path)
        
        # 환경변수 파일 생성
        env_file = os.path.join(model_dir, ".env")
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(f"MODEL_PATH={test_model_path}\n")
            f.write("SELECTED_MODEL=test-simple-model\n")
        
        print(f"✅ 테스트 모델 생성 완료: {test_model_path}")
        print("🔧 이제 main.py에서 이 모델을 사용할 수 있습니다.")
        
    except Exception as e:
        print(f"❌ 테스트 모델 생성 실패: {str(e)}")
        raise

if __name__ == "__main__":
    create_test_model() 