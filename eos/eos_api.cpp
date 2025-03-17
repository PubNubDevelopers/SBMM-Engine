#include <future>
#include <iostream>
#include <string>
#include <vector>
#include <unistd.h>

#include <boost/json.hpp>
#include <crow.h>

#include "eos_sdk.h"
#include "eos_logging.h"
#include "eos_auth.h"
#include "eos_connect.h"
#include "eos_sessions.h"
#include "eos_types.h"
#include "eos_common.h"

#ifdef __APPLE__
#include <CoreFoundation/CoreFoundation.h>
#endif
#include <cstdlib>

using namespace std;
namespace json = boost::json;

// Global EOS Handles
EOS_HSessions SessionHandle = nullptr;
EOS_HPlatform PlatformHandle = nullptr;
EOS_HSessionSearch GlobalSessionSearchHandle = nullptr;

// 📌 Periodic Tick Function (Runs EOS Events)
void TickEOS() {
    int tickCounter = 0;
    while (true) {
        if (PlatformHandle) {
            EOS_Platform_Tick(PlatformHandle);
            tickCounter++;

            // Print log every ~5 seconds
            if (tickCounter % 300 == 0) {
                cout << "🔄 EOS Tick is running..." << endl;
            }
        } else {
            cout << "⚠️ PlatformHandle is NULL!" << endl;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(1)); // ~60 FPS tick
    }
}

// 📌 EOS Initialization Function
void InitializeEOS() {
    cout << "🚀 Initializing EOS SDK..." << endl;

    // ✅ Initialize EOS Core
    EOS_InitializeOptions InitOptions = {};
    InitOptions.ApiVersion = EOS_INITIALIZE_API_LATEST;
    InitOptions.ProductName = "SBMM Engine";
    InitOptions.ProductVersion = "1.0";

    EOS_EResult InitResult = EOS_Initialize(&InitOptions);
    if (InitResult != EOS_EResult::EOS_Success) {
        cerr << "❌ ERROR: Failed to initialize EOS SDK! Error: " << EOS_EResult_ToString(InitResult) << endl;
        exit(1);
    }
    cout << "✅ EOS SDK core initialized!" << endl;

    // ✅ Configure EOS Platform Options
    EOS_Platform_Options PlatformOptions = {};
    PlatformOptions.ApiVersion = EOS_PLATFORM_OPTIONS_API_LATEST;
    PlatformOptions.Reserved = nullptr;
    PlatformOptions.EncryptionKey = nullptr;
    PlatformOptions.SystemSpecificOptions = nullptr;

    const char* productId = std::getenv("EOS_PRODUCT_ID");
    const char* sandboxId = std::getenv("EOS_SANDBOX_ID");
    const char* deploymentId = std::getenv("EOS_DEPLOYMENT_ID");
    const char* clientId = std::getenv("EOS_CLIENT_ID");
    const char* clientSecret = std::getenv("EOS_CLIENT_SECRET");

    if (!productId || !sandboxId || !deploymentId || !clientId || !clientSecret) {
        std::cerr << "❌ ERROR: Missing required environment variables!" << std::endl;
        exit(1);
    }

    // Assign safely
    PlatformOptions.ProductId = productId;
    PlatformOptions.SandboxId = sandboxId;
    PlatformOptions.DeploymentId = deploymentId;
    PlatformOptions.ClientCredentials.ClientId = clientId;
    PlatformOptions.ClientCredentials.ClientSecret = clientSecret;

    // ✅ Server Mode (No User Login Required)
    PlatformOptions.bIsServer = EOS_TRUE;
    PlatformOptions.TickBudgetInMilliseconds = 16;

    // ✅ Create EOS Platform
    cout << "🔄 Creating EOS Platform..." << endl;
    PlatformHandle = EOS_Platform_Create(&PlatformOptions);

    if (!PlatformHandle) {
        cerr << "❌ ERROR: Failed to create EOS platform! Check credentials and settings." << endl;
        exit(1);
    }
    cout << "✅ EOS Platform created successfully!" << endl;

    // ✅ Initialize Sessions Interface
    SessionHandle = EOS_Platform_GetSessionsInterface(PlatformHandle);
    if (!SessionHandle) {
        cerr << "❌ ERROR: Failed to get EOS Sessions interface!" << endl;
        exit(1);
    }
    cout << "✅ EOS Sessions interface initialized!" << endl;
}

void EOS_CALL EOS_CreateSessionCompleteCallback(const EOS_Sessions_UpdateSessionCallbackInfo* Data) {
    cout << "🔔 EOS_CreateSessionCompleteCallback has been triggered!" << endl;

    if (!Data) {
        cout << "❌ ERROR: Callback received NULL data!" << endl;
        return;
    }

    cout << "📡 Callback Result: " << EOS_EResult_ToString(Data->ResultCode) << endl;

    if (Data->ResultCode == EOS_EResult::EOS_Success) {
        cout << "✅ Session successfully created/updated!" << endl;
    } else if (Data->ResultCode == EOS_EResult::EOS_Sessions_OutOfSync) {
        cout << "⚠️ WARNING: Session is out of sync and will be updated later!" << endl;
    } else {
        cout << "❌ ERROR: Session creation/update failed! Error: " << EOS_EResult_ToString(Data->ResultCode) << endl;
    }
}

string CreateSession(const string& sessionName) {
    if (!SessionHandle) {
        cerr << "❌ ERROR: SessionHandle is NULL! EOS SDK may not be initialized." << endl;
        return "";
    }

    EOS_Sessions_CreateSessionModificationOptions CreateOptions = {};
    CreateOptions.ApiVersion = EOS_SESSIONS_CREATESESSIONMODIFICATION_API_LATEST;
    CreateOptions.SessionName = sessionName.c_str();
    CreateOptions.BucketId = "sbmm_default_bucket";
    CreateOptions.MaxPlayers = 2;

    EOS_HSessionModification SessionModificationHandle = nullptr;
    EOS_EResult Result = EOS_Sessions_CreateSessionModification(SessionHandle, &CreateOptions, &SessionModificationHandle);

    if (Result != EOS_EResult::EOS_Success) {
        cerr << "❌ ERROR: Failed to create session modification. Error: " << EOS_EResult_ToString(Result) << endl;
        return "";
    }

    cout << "✅ Session modification handle created for: " << sessionName << endl;

    // ✅ Explicitly set the bucket ID before updating the session
    EOS_SessionModification_SetBucketIdOptions BucketOptions = {};
    BucketOptions.ApiVersion = EOS_SESSIONMODIFICATION_SETBUCKETID_API_LATEST;
    BucketOptions.BucketId = "sbmm_default_bucket";  // ✅ Ensure this bucket exists in EOS dashboard

    Result = EOS_SessionModification_SetBucketId(SessionModificationHandle, &BucketOptions);
    if (Result != EOS_EResult::EOS_Success) {
        cerr << "❌ ERROR: Failed to set bucket ID! Error: " << EOS_EResult_ToString(Result) << endl;
        EOS_SessionModification_Release(SessionModificationHandle);
        return "";
    }
    cout << "✅ Bucket ID set successfully for session: " << sessionName << endl;

    // ✅ Now update the session
    EOS_Sessions_UpdateSessionOptions UpdateOptions = {};
    UpdateOptions.ApiVersion = EOS_SESSIONS_UPDATESESSION_API_LATEST;
    UpdateOptions.SessionModificationHandle = SessionModificationHandle;

    EOS_Sessions_UpdateSession(SessionHandle, &UpdateOptions, nullptr, EOS_CreateSessionCompleteCallback);

    cout << "✅ Session update request sent." << endl;

    return sessionName;
}

// 🎯 API Endpoint: Matchmaking (Creates a session)
crow::response MatchPlayers(const crow::request& req) {
    try {
        // Parse request body
        std::string request_body = req.body;
        auto body = json::parse(request_body);

        // Extract player IDs
        std::string player1 = std::string(body.at("player1").as_string().c_str());
        std::string player2 = std::string(body.at("player2").as_string().c_str());

        // Generate a unique session name
        string sessionName = "match_" + player1 + "_" + player2;

        // Create session in EOS
        string createdSession = CreateSession(sessionName);

        if (!createdSession.empty()) {
            json::object res;
            res["session_id"] = createdSession;
            res["status"] = "created";
            return crow::response{200, json::serialize(res)};
        } else {
            return crow::response{500, "Failed to create session"};
        }
    } catch (const std::exception& e) {
        cerr << "❌ Exception: " << e.what() << endl;
        return crow::response{400, "Invalid request format"};
    }
}

void EOS_CALL DestroySessionCallback(const EOS_Sessions_DestroySessionCallbackInfo* Data) {
    if (!Data) {
        cout << "❌ ERROR: DestroySession callback received NULL data!" << endl;
        return;
    }

    if (Data->ResultCode == EOS_EResult::EOS_Success) {
        cout << "✅ Session destroyed successfully!" << endl;
    } else {
        cout << "❌ ERROR: Failed to destroy session. Error: " << EOS_EResult_ToString(Data->ResultCode) << endl;
    }
}

bool DestroySession(const string& sessionId) {
    if (!SessionHandle) {
        cerr << "❌ ERROR: SessionHandle is NULL! EOS SDK may not be initialized." << endl;
        return false;
    }

    EOS_Sessions_DestroySessionOptions DestroyOptions = {};
    DestroyOptions.ApiVersion = EOS_SESSIONS_DESTROYSESSION_API_LATEST;
    DestroyOptions.SessionName = sessionId.c_str();

    EOS_Sessions_DestroySession(SessionHandle, &DestroyOptions, nullptr, DestroySessionCallback);

    cout << "🛑 Destroy session request sent for: " << sessionId << endl;
    return true;
}

void EOS_CALL StartSessionCallback(const EOS_Sessions_StartSessionCallbackInfo* Data) {
    if (!Data) {
        std::cerr << "❌ ERROR: StartSession callback received NULL data!" << std::endl;
        return;
    }

    std::cout << "🔔 StartSession Callback Triggered!" << std::endl;
    std::cout << "📡 Callback Result: " << EOS_EResult_ToString(Data->ResultCode) << std::endl;

    switch (Data->ResultCode) {
        case EOS_EResult::EOS_Success:
            std::cout << "✅ Session successfully started!" << std::endl;
            break;
        case EOS_EResult::EOS_NotFound:
            std::cerr << "❌ ERROR: Session not found!" << std::endl;
            break;
        case EOS_EResult::EOS_Sessions_OutOfSync:
            std::cerr << "⚠️ WARNING: Session is out of sync. Will update on next backend connection!" << std::endl;
            break;
        case EOS_EResult::EOS_InvalidParameters:
            std::cerr << "❌ ERROR: Invalid session parameters!" << std::endl;
            break;
        default:
            std::cerr << "❌ ERROR: Failed to start session! Error: " << EOS_EResult_ToString(Data->ResultCode) << std::endl;
            break;
    }
}

void StartEOSSession(EOS_HSessions SessionHandle, const std::string& sessionName) {
    if (!SessionHandle) {
        std::cerr << "❌ ERROR: SessionHandle is NULL!" << std::endl;
        return;
    }

    EOS_Sessions_StartSessionOptions StartOptions = {};
    StartOptions.ApiVersion = EOS_SESSIONS_STARTSESSION_API_LATEST;
    StartOptions.SessionName = sessionName.c_str();

    std::cout << "🎮 Requesting to start session: " << sessionName << std::endl;

    EOS_Sessions_StartSession(SessionHandle, &StartOptions, nullptr, StartSessionCallback);
}

// 🎯 Main function: Starts API server
int main() {
    cout << "🚀 Starting SBMM API..." << endl;

    // ✅ Initialize EOS SDK
    InitializeEOS();

    // ✅ Start API Server
    crow::SimpleApp app;

    // Register API Routes
    CROW_ROUTE(app, "/matchmaking").methods("POST"_method)(MatchPlayers);
    CROW_ROUTE(app, "/session/<string>").methods("DELETE"_method)([](const crow::request&, string sessionId) {
        cout << "🛑 Destroying session: " << sessionId << endl;

        bool success = DestroySession(sessionId);
        if (success) {
            json::object res;
            res["session_id"] = sessionId;
            res["status"] = "destroyed";
            return crow::response{200, json::serialize(res)};
        }

        return crow::response{500, "Failed to destroy session"};
    });
    CROW_ROUTE(app, "/session/start/<string>").methods("POST"_method)([](const crow::request&, string sessionId) {
        cout << "🎮 Starting session: " << sessionId << endl;

        if (!SessionHandle) {
            cerr << "❌ ERROR: SessionHandle is NULL!" << endl;
            return crow::response{500, "SessionHandle is NULL"};
        }

        // Start the session
        StartEOSSession(SessionHandle, sessionId);

        // Respond with session ID and status
        json::object res;
        res["session_id"] = sessionId;
        res["status"] = "started";
        return crow::response{200, json::serialize(res)};
    });


    cout << "✅ API Server is running on port 8080..." << endl;

    // ✅ Run Crow server in a separate thread so we can continue running the EOS event loop
    const char* portStr = std::getenv("SERVER_PORT");
    if (!portStr) {
        std::cerr << "❌ ERROR: SERVER_PORT environment variable not set!" << std::endl;
        exit(1);
    }
    int serverPort = std::atoi(portStr);

    std::thread serverThread([&app, serverPort]() { // Capture serverPort by value
        app.port(serverPort).multithreaded().run();
    });

    // ✅ Keep EOS platform ticking (MacOS Fix)
    #ifdef __APPLE__
    while (CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, true)) {
        EOS_Platform_Tick(PlatformHandle);
    }
    #else
    while (true) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        EOS_Platform_Tick(PlatformHandle);
    }
    #endif

    // ✅ Join server thread before exiting (This ensures clean shutdown)
    serverThread.join();

    return 0;
}