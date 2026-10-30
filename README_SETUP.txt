NOVA AI — ADVANCED VERSION

WHAT'S NEW
- Redesigned responsive interface with a modern workspace layout.
- Conversation history saved in browser localStorage.
- Delete individual conversations and clear current chat.
- Export a conversation as a .txt file.
- Dark/light appearance toggle.
- Markdown-style answers and formatted code blocks with copy buttons.
- Backend health indicator.
- C++ backend now sends recent conversation history to the AI.
- Input validation, request-size limits, clearer API errors and health endpoint.

PROJECT STRUCTURE
backend/
  AIProvider.h
  AIProvider.cpp
  main.cpp
  httplib.h             (retained from your original project)
frontend/
  index.html
  style.css
  script.js

REQUIREMENTS
- C++17 compiler (MinGW g++ recommended)
- OpenSSL development libraries compatible with cpp-httplib
- nlohmann/json.hpp header
- OpenAI API key

IMPORTANT DEPENDENCY NOTE
Your original ZIP did not include nlohmann/json.hpp or OpenSSL development files.
Install/provide these dependencies and make sure the include/library paths are set
when compiling. The existing httplib.h is retained.

SET API KEY (Windows CMD)
set OPENAI_API_KEY=your_actual_api_key

COMPILE (example; adjust paths for your installed dependencies)
g++ -std=c++17 -O2 main.cpp AIProvider.cpp -o nova.exe -lssl -lcrypto -lws2_32

RUN
1. Open CMD in the backend folder.
2. Set OPENAI_API_KEY in that same CMD window.
3. Run: nova.exe
4. Open frontend/index.html with VS Code Live Server (recommended, usually port 5500).
5. Keep the backend terminal open.

BACKEND ADDRESS
http://127.0.0.1:8080
Health check: http://127.0.0.1:8080/health

CORS
The backend currently allows the common VS Code Live Server origin:
http://127.0.0.1:5500
If your Live Server uses another port/origin, update Access-Control-Allow-Origin
in backend/main.cpp to match it.

SECURITY
- Never put your API key in frontend JavaScript or HTML.
- Do not upload the API key or a compiled binary containing secrets.
- This project is configured for local development, not public production hosting.
