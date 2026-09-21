#!/bin/sh
# Start the coach with speech credentials loaded into the server process environment.
#
# The application never reads a credentials file: it reads process.env only, and the
# key must never reach the browser, the workspace, test artifacts, Git or a log. This
# script is the seam — it sources your file, exports what it finds, and hands the
# environment to the server. Nothing here prints a value.
#
# Override the location with COACH_SPEECH_ENV=/some/other/file.
set -e

# An instance left running on this port is the most common reason a restart seems to
# change nothing: the browser keeps talking to the old process. Say so, and say which
# one, instead of letting it fail with a bare EADDRINUSE.
port="${PORT:-4310}"
busy="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
if [ -n "$busy" ]; then
  # Braces matter here: a full-width bracket straight after the name mangles the value.
  echo "127.0.0.1:${port} 已經有服務在跑（PID ${busy}），新的不會啟動。" >&2
  echo "你的瀏覽器現在連的是那個舊的，所以改了設定也看不出變化。" >&2
  echo "" >&2
  echo "  先停掉它：  kill $busy" >&2
  echo "  再啟動：    npm run start:speech" >&2
  echo "" >&2
  echo "或換一個埠號開：PORT=4311 npm run start:speech" >&2
  exit 1
fi

env_file="${COACH_SPEECH_ENV:-$HOME/.config/interview-coach/speech.env}"

if [ ! -f "$env_file" ]; then
  echo "找不到語音設定檔：$env_file" >&2
  echo "請建立它（參考 .env.example），或用 COACH_SPEECH_ENV 指定其他路徑。" >&2
  exit 1
fi

case "$(ls -l "$env_file" | cut -c1-10)" in
  -rw-------) ;;
  *) echo "提醒：$env_file 的權限不是 600，其他使用者可能讀得到你的金鑰。" >&2
     echo "      建議執行：chmod 600 \"$env_file\"" >&2 ;;
esac

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

if [ -z "$OPENAI_API_KEY" ]; then
  echo "提醒：$env_file 裡沒有 OPENAI_API_KEY，語音轉錄與朗讀會無法使用。" >&2
fi
if [ "${COACH_SPEECH_PROVIDER:-fake}" != "openai" ]; then
  echo "提醒：COACH_SPEECH_PROVIDER 目前是 ${COACH_SPEECH_PROVIDER:-fake}，仍會使用本機示範語音。" >&2
fi

echo "語音設定已載入（金鑰只存在於這個行程的環境中）。"
echo "語音轉錄：${COACH_SPEECH_MODEL:-gpt-4o-mini-transcribe}　朗讀：${COACH_TTS_MODEL:-gpt-4o-mini-tts}"
echo "這會對 OpenAI 產生實際費用。"
exec node src/server.js
