#include "httplib.h"
#include "AIProvider.h"
#include <nlohmann/json.hpp>
#include <iostream>
#include <algorithm>
#include <cctype>

using json = nlohmann::json;

static std::string trim(const std::string& value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

int main() {
    httplib::Server server;
    AIProvider ai;

    server.set_payload_max_length(1024 * 64);
    server.set_default_headers({
        {"Access-Control-Allow-Origin", "http://127.0.0.1:5500"},
        {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type"},
        {"Cache-Control", "no-store"}
    });

    server.Options("/(.*)", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    server.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(R"({"status":"ok","service":"Nova AI"})", "application/json");
    });

    server.Post("/chat", [&ai](const httplib::Request& req, httplib::Response& res) {
        try {
            const auto body = json::parse(req.body);
            if (!body.contains("message") || !body["message"].is_string()) {
                res.status = 400;
                res.set_content(R"({"error":"Please enter a valid message."})", "application/json");
                return;
            }

            const std::string message = trim(body["message"].get<std::string>());
            if (message.empty()) {
                res.status = 400;
                res.set_content(R"({"error":"Message cannot be empty."})", "application/json");
                return;
            }
            if (message.size() > 12000) {
                res.status = 413;
                res.set_content(R"({"error":"Message is too long. Keep it under 12,000 characters."})", "application/json");
                return;
            }

            std::vector<ChatMessage> history;
            if (body.contains("history") && body["history"].is_array()) {
                for (const auto& item : body["history"]) {
                    if (!item.is_object() || !item.contains("role") ||
                        !item.contains("content") || !item["role"].is_string() ||
                        !item["content"].is_string()) continue;

                    std::string role = item["role"].get<std::string>();
                    std::string content = item["content"].get<std::string>();
                    if ((role == "user" || role == "assistant") && !content.empty()) {
                        history.push_back({role, content});
                    }
                }
            }

            AIResult result = ai.getResponse(message, history);
            if (!result.success) {
                res.status = 502;
                res.set_content(json({{"error", result.error}}).dump(), "application/json");
                return;
            }

            res.set_content(json({
                {"reply", result.text},
                {"model", "gpt-4.1-mini"}
            }).dump(), "application/json");
        } catch (const json::exception&) {
            res.status = 400;
            res.set_content(R"({"error":"Invalid JSON request."})", "application/json");
        } catch (...) {
            res.status = 500;
            res.set_content(R"({"error":"Unexpected server error."})", "application/json");
        }
    });

    std::cout << "  NOVA AI SERVER\n"
              << "  API:    http://127.0.0.1:8080\n"
              << "  Health: http://127.0.0.1:8080/health\n"
              << "  Keep this window open while using Nova AI.\n\n";

    if (!server.listen("127.0.0.1", 8080)) {
        std::cerr << "Server could not start. Check whether port 8080 is already in use.\n";
        return 1;
    }
    return 0;
}
