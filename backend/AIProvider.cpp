#define CPPHTTPLIB_OPENSSL_SUPPORT

#include "AIProvider.h"
#include "httplib.h"
#include <nlohmann/json.hpp>
#include <cstdlib>
#include <algorithm>

using json = nlohmann::json;

AIResult AIProvider::getResponse(const std::string& message,
                                 const std::vector<ChatMessage>& history) {
    const char* key = std::getenv("OPENAI_API_KEY");
    if (!key || std::string(key).empty()) {
        return {false, "", "OPENAI_API_KEY is not configured. Set it before starting the server."};
    }

    httplib::SSLClient client("api.openai.com", 443);
    client.set_connection_timeout(10, 0);
    client.set_read_timeout(90, 0);
    client.set_write_timeout(20, 0);
    client.enable_server_certificate_verification(true);

    json messages = json::array();
    messages.push_back({
        {"role", "system"},
        {"content",
         "You are Nova AI, a capable, friendly assistant. "
         "Give accurate, structured answers. Explain difficult topics clearly. "
         "For programming questions, provide runnable code and explain important parts. "
         "Use Markdown headings, lists and code blocks when useful. "
         "If you are uncertain, say so instead of inventing facts."}
    });

    // Keep only the latest 12 previous messages to limit request size.
    const std::size_t start = history.size() > 12 ? history.size() - 12 : 0;
    for (std::size_t i = start; i < history.size(); ++i) {
        const auto& item = history[i];
        if ((item.role == "user" || item.role == "assistant") &&
            !item.content.empty() && item.content.size() <= 12000) {
            messages.push_back({{"role", item.role}, {"content", item.content}});
        }
    }
    messages.push_back({{"role", "user"}, {"content", message}});

    json payload = {
        {"model", "gpt-4.1-mini"},
        {"messages", messages},
        {"temperature", 0.7},
        {"max_tokens", 1800}
    };

    httplib::Headers headers = {
        {"Authorization", std::string("Bearer ") + key},
        {"Content-Type", "application/json"}
    };

    auto response = client.Post("/v1/chat/completions", headers,
                                payload.dump(), "application/json");

    if (!response) {
        return {false, "", "Could not connect to OpenAI. Check your internet connection and try again."};
    }

    if (response->status != 200) {
        std::string detail = "OpenAI request failed (HTTP " +
                             std::to_string(response->status) + ").";
        try {
            auto err = json::parse(response->body);
            if (err.contains("error") && err["error"].contains("message") &&
                err["error"]["message"].is_string()) {
                detail += " " + err["error"]["message"].get<std::string>();
            }
        } catch (...) {}
        return {false, "", detail};
    }

    try {
        auto result = json::parse(response->body);
        std::string answer = result.at("choices").at(0).at("message")
                                  .at("content").get<std::string>();
        if (answer.empty()) return {false, "", "The AI returned an empty response. Please try again."};
        return {true, answer, ""};
    } catch (...) {
        return {false, "", "The AI response could not be understood. Please try again."};
    }
}
