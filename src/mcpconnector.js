"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPConnector = void 0;
var MCPConnector = /** @class */ (function () {
    function MCPConnector(apiUrl, client) {
        this.apiUrl = apiUrl;
        this.serverPath = 'server_mcp.py';
        this.connected = false;
        this.client = client;
    }
    MCPConnector.prototype.isConnected = function () {
        return this.connected;
    };
    MCPConnector.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.checkHealth()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.checkHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, fetch("".concat(this.apiUrl, "/health"))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        this.client.updateConnectionStatus(data.status === 'healthy', 'API Ready');
                        this.client.updateApiStatus(data.status);
                        if (!(data.status === 'healthy')) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.connectToServer()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        this.client.updateConnectionStatus(false, 'API Offline');
                        this.client.updateApiStatus('Offline');
                        console.error('Health check failed:', error_1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.connectToServer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        this.client.notify('🔌 Connecting to MCP server...');
                        return [4 /*yield*/, fetch("".concat(this.apiUrl, "/connect"), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ server_script_path: this.serverPath })
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Connection failed: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        this.connected = true;
                        this.client.updateConnectionStatus(true, "Connected (".concat(data.tools.length, " tools)"));
                        this.client.notify("\u2705 Connected! ".concat(data.tools.length, " tools available"));
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        this.connected = false;
                        this.client.updateConnectionStatus(false, 'Connection Failed');
                        this.client.notify("\u274C Connection failed: ".concat(error_2.message));
                        console.error('Connection error:', error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.sendQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, lastMessage, error_3, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("".concat(this.apiUrl, "/query"), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    query: query,
                                    reset_conversation: false,
                                    max_messages_return: 1
                                })
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Query failed: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        if (data.messages && data.messages.length > 0) {
                            lastMessage = data.messages[data.messages.length - 1];
                            if (lastMessage.role === 'assistant') {
                                this.client.handleQueryResponse(true, lastMessage);
                                return [2 /*return*/];
                            }
                        }
                        this.client.handleQueryResponse(false, undefined, 'No response from server');
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        errorMsg = "Error: ".concat(error_3.message, ". Make sure the FastAPI server is running at ").concat(this.apiUrl);
                        this.client.handleQueryResponse(false, undefined, errorMsg);
                        console.error('Query error:', error_3);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.clearConversation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fetch("".concat(this.apiUrl, "/conversation/clear"), { method: 'POST' })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        console.error('Failed to clear conversation:', e_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.handleExtractRegisters = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pdfPath, btn, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pdfPath = prompt('Enter PDF file path (e.g., C:\\path\\to\\stm32.pdf):');
                        if (!pdfPath)
                            return [2 /*return*/];
                        btn = document.getElementById('extractRegisterBtn');
                        btn === null || btn === void 0 ? void 0 : btn.classList.add('loading');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        query = "Extract all registers from \"".concat(pdfPath, "\"");
                        return [4 /*yield*/, this.sendToolQuery(query)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        btn === null || btn === void 0 ? void 0 : btn.classList.remove('loading');
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.handleSearchRegister = function () {
        return __awaiter(this, void 0, void 0, function () {
            var registerName, btn, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        registerName = prompt('Enter register name to search (e.g., CRC_DR):');
                        if (!registerName)
                            return [2 /*return*/];
                        btn = document.getElementById('searchRegisterBtn');
                        btn === null || btn === void 0 ? void 0 : btn.classList.add('loading');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        query = "Search for register \"".concat(registerName, "\"");
                        return [4 /*yield*/, this.sendToolQuery(query)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        btn === null || btn === void 0 ? void 0 : btn.classList.remove('loading');
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.handleGetRegister = function () {
        return __awaiter(this, void 0, void 0, function () {
            var registerName, btn, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        registerName = prompt('Enter exact register name (e.g., CRC_DR):');
                        if (!registerName)
                            return [2 /*return*/];
                        btn = document.getElementById('getRegisterBtn');
                        btn === null || btn === void 0 ? void 0 : btn.classList.add('loading');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        query = "Get register \"".concat(registerName, "\" with all details");
                        return [4 /*yield*/, this.sendToolQuery(query)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        btn === null || btn === void 0 ? void 0 : btn.classList.remove('loading');
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.handleExtractImages = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pdfPath, startPage, endPage, btn, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pdfPath = prompt('Enter PDF file path:');
                        if (!pdfPath)
                            return [2 /*return*/];
                        startPage = prompt('Enter start page (e.g., 122):');
                        if (!startPage)
                            return [2 /*return*/];
                        endPage = prompt('Enter end page (e.g., 125):');
                        if (!endPage)
                            return [2 /*return*/];
                        btn = document.getElementById('extractImagesBtn');
                        btn === null || btn === void 0 ? void 0 : btn.classList.add('loading');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        query = "Extract images from \"".concat(pdfPath, "\" pages ").concat(startPage, " to ").concat(endPage);
                        return [4 /*yield*/, this.sendToolQuery(query)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        btn === null || btn === void 0 ? void 0 : btn.classList.remove('loading');
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.handleGetPdfTitles = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pdfPath, btn, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pdfPath = prompt('Enter PDF file path:');
                        if (!pdfPath)
                            return [2 /*return*/];
                        btn = document.getElementById('getPdfTitlesBtn');
                        btn === null || btn === void 0 ? void 0 : btn.classList.add('loading');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        query = "Get table of contents from \"".concat(pdfPath, "\"");
                        return [4 /*yield*/, this.sendToolQuery(query)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        btn === null || btn === void 0 ? void 0 : btn.classList.remove('loading');
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MCPConnector.prototype.sendToolQuery = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var messageInput, sendButton;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.connected) {
                            this.client.notify('❌ Not connected to server');
                            return [2 /*return*/];
                        }
                        messageInput = document.getElementById('messageInput');
                        sendButton = document.getElementById('sendButton');
                        messageInput.value = query;
                        sendButton.disabled = false;
                        return [4 /*yield*/, this.client.sendMessage()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return MCPConnector;
}());
exports.MCPConnector = MCPConnector;
