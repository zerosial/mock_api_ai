#!/bin/bash

# 첫 진입 시에는 즉시 체크, 이후에는 1시간에 한 번만 체크
HEALTH_FILE="/tmp/health_first_check"
LAST_CHECK_FILE="/tmp/health_last_check"
CURRENT_TIME=$(date +%s)
LOG_FILE="/tmp/health_check.log"

# 로그 함수
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 첫 번째 체크인지 확인
if [ ! -f "$HEALTH_FILE" ]; then
    # 첫 번째 체크: 즉시 수행
    log_message "First health check - checking immediately"
    touch "$HEALTH_FILE"
    echo "$CURRENT_TIME" > "$LAST_CHECK_FILE"
    if curl -f http://localhost:8000/health; then
        log_message "First health check successful"
        exit 0
    else
        log_message "First health check failed"
        exit 1
    fi
else
    # 이후 체크: 1시간(3600초) 간격으로 수행
    if [ -f "$LAST_CHECK_FILE" ]; then
        LAST_CHECK_TIME=$(cat "$LAST_CHECK_FILE")
        TIME_DIFF=$((CURRENT_TIME - LAST_CHECK_TIME))
        
        if [ $TIME_DIFF -ge 3600 ]; then
            # 1시간이 지났으면 체크 수행
            log_message "Health check after 1 hour interval (${TIME_DIFF}s elapsed)"
            echo "$CURRENT_TIME" > "$LAST_CHECK_FILE"
            if curl -f http://localhost:8000/health; then
                log_message "Health check successful"
                exit 0
            else
                log_message "Health check failed"
                exit 1
            fi
        else
            # 1시간이 지나지 않았으면 성공으로 처리 (체크 건너뛰기)
            REMAINING_TIME=$((3600 - TIME_DIFF))
            log_message "Health check skipped - waiting for 1 hour interval (${REMAINING_TIME}s remaining)"
            exit 0
        fi
    else
        # 마지막 체크 시간 파일이 없으면 현재 시간으로 설정하고 체크 수행
        log_message "Last check file missing - performing health check"
        echo "$CURRENT_TIME" > "$LAST_CHECK_FILE"
        if curl -f http://localhost:8000/health; then
            log_message "Health check successful"
            exit 0
        else
            log_message "Health check failed"
            exit 1
        fi
    fi
fi 