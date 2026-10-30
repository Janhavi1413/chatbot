#ifndef AI_PROVIDER_H
#define AI_PROVIDER_H

#include <string>
#include <vector>

struct ChatMessage {
    std::string role;
    std::string content;
};

struct AIResult {
    bool success;
    std::string text;
    std::string error;
};

class AIProvider {
public:
    AIResult getResponse(const std::string& message,
                         const std::vector<ChatMessage>& history);
};

#endif
