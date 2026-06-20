import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as cp from 'child_process';

interface StatusPayload {
    tool: string;
    status: 'idle' | 'working' | 'error' | 'completed';
    summary: string;
}

let statusBarItem: vscode.StatusBarItem;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptions: vscode.Disposable[] = [];
let currentStatus: StatusPayload['status'] = 'idle';
let lastEditorPath: string = '';
let resolvedToolName: string = '';
let isTraeIDE = false;

// Trae AI 状态追踪
let traeAIState: 'idle' | 'chatting' | 'building' = 'idle';
let traeAISummary = '';
let traeAIIdleTimer: ReturnType<typeof setTimeout> | null = null;
let traeFileChangeCount = 0;
let traeFileChangeTimer: ReturnType<typeof setTimeout> | null = null;
let traeWebviewVisible = false;
let traePollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 自动检测当前 IDE 类型
 */
function detectIDE(): string {
    const appName = vscode.env.appName.toLowerCase();
    const appRoot = vscode.env.appRoot.toLowerCase();

    if (appName.includes('cursor') || appRoot.includes('cursor')) {
        return 'cursor';
    }
    if (appName.includes('trae') || appRoot.includes('trae')) {
        return 'trae';
    }
    if (appName.includes('windsurf') || appRoot.includes('windsurf')) {
        return 'windsurf';
    }
    if (appName.includes('solo') || appRoot.includes('solo')) {
        return 'trae';
    }
    return 'vscode';
}

/**
 * 获取工具名称（支持 auto 自动检测）
 */
function getToolName(): string {
    const config = vscode.workspace.getConfiguration('desktopxpet-monitor');
    const configured = config.get<string>('toolName', 'auto');
    if (configured === 'auto' || !configured) {
        return detectIDE();
    }
    return configured;
}

function getConfig() {
    const config = vscode.workspace.getConfiguration('desktopxpet-monitor');
    const port = config.get<number>('serverPort', 9527);
    const token = config.get<string>('serverToken', '') || readTokenFromConfig();
    const idleTimeout = config.get<number>('idleTimeout', 60);
    const enabled = config.get<boolean>('enabled', true);
    const traeAIMonitor = config.get<boolean>('traeAIMonitor', true);
    return { port, token, idleTimeout, enabled, traeAIMonitor };
}

function readTokenFromConfig(): string {
    const configPaths = [
        path.join(os.homedir(), '.xpet', 'config.json'),
        path.join(os.homedir(), '.desktopxpet', 'config.json'),
        path.join(os.tmpdir(), 'desktopxpet-config.json')
    ];
    for (const configPath of configPaths) {
        try {
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf-8');
                const parsed = JSON.parse(data);
                if (parsed.token) {
                    return parsed.token;
                }
            }
        } catch {
            // 继续尝试下一个路径
        }
    }
    return '';
}

function getFileName(filePath: string): string {
    return path.basename(filePath);
}

function getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
        '.ts': 'TypeScript', '.js': 'JavaScript', '.tsx': 'TypeScript React',
        '.jsx': 'JavaScript React', '.py': 'Python', '.java': 'Java',
        '.go': 'Go', '.rs': 'Rust', '.c': 'C', '.cpp': 'C++',
        '.h': 'C/C++ Header', '.cs': 'C#', '.rb': 'Ruby', '.php': 'PHP',
        '.swift': 'Swift', '.kt': 'Kotlin', '.html': 'HTML', '.css': 'CSS',
        '.scss': 'SCSS', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
        '.md': 'Markdown', '.sql': 'SQL', '.sh': 'Shell', '.bat': 'Batch',
        '.ps1': 'PowerShell',
    };
    return map[ext] || ext.slice(1) || 'Unknown';
}

function updateStatusBar(status: StatusPayload['status']) {
    if (!statusBarItem) {
        return;
    }
    const toolLabel = resolvedToolName.charAt(0).toUpperCase() + resolvedToolName.slice(1);
    switch (status) {
        case 'working':
            statusBarItem.text = `$(sync~spin) XPet: ${toolLabel} Working`;
            statusBarItem.tooltip = `DesktopXPet - ${toolLabel} (Working)`;
            statusBarItem.backgroundColor = undefined;
            break;
        case 'idle':
            statusBarItem.text = `$(circle-outline) XPet: ${toolLabel} Idle`;
            statusBarItem.tooltip = `DesktopXPet - ${toolLabel} (Idle)`;
            statusBarItem.backgroundColor = undefined;
            break;
        case 'error':
            statusBarItem.text = `$(warning) XPet: Error`;
            statusBarItem.tooltip = `DesktopXPet - Connection Error`;
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
        case 'completed':
            statusBarItem.text = `$(check) XPet: Done`;
            statusBarItem.tooltip = `DesktopXPet - Completed`;
            statusBarItem.backgroundColor = undefined;
            break;
    }
    statusBarItem.show();
}

function resetIdleTimer() {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    const { idleTimeout, enabled } = getConfig();
    if (!enabled) {
        return;
    }
    idleTimer = setTimeout(() => {
        // Trae AI 状态优先：如果 AI 正在工作，不回 idle
        if (isTraeIDE && traeAIState !== 'idle') {
            return;
        }
        pushStatus({
            tool: resolvedToolName,
            status: 'idle',
            summary: 'No activity',
        });
    }, idleTimeout * 1000);
}

function pushStatus(payload: StatusPayload) {
    const { port, token, enabled } = getConfig();
    if (!enabled) {
        return;
    }

    // 确保使用最新的 toolName
    payload.tool = resolvedToolName;
    currentStatus = payload.status;
    updateStatusBar(payload.status);

    const body = JSON.stringify(payload);
    const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path: '/api/status',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-pet-token': token,
        },
        timeout: 3000,
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                if (currentStatus === 'error') {
                    currentStatus = 'idle';
                    updateStatusBar('idle');
                }
            }
        });
    });

    req.on('error', () => {
        updateStatusBar('error');
    });

    req.on('timeout', () => {
        req.destroy();
        updateStatusBar('error');
    });

    req.write(body);
    req.end();
}

function buildSummary(editor: vscode.TextEditor | undefined, event?: string): string {
    if (event === 'save') {
        const doc = editor?.document;
        if (doc) {
            const fileName = getFileName(doc.fileName);
            const lang = getLanguageId(doc.fileName);
            return `Saved ${fileName} (${lang})`;
        }
        return 'File saved';
    }
    if (event === 'idle') {
        return 'No activity';
    }
    if (editor) {
        const doc = editor.document;
        const fileName = getFileName(doc.fileName);
        const lang = getLanguageId(doc.fileName);
        const line = editor.selection.active.line + 1;
        return `Editing ${fileName}:${line} (${lang})`;
    }
    return 'No editor';
}

// ============================================================
// Trae AI 状态检测
// ============================================================

/**
 * 推送 Trae AI 状态（带去重，避免重复推送相同状态）
 */
function pushTraeAIStatus(state: 'idle' | 'chatting' | 'building', summary: string) {
    if (state === traeAIState && summary === traeAISummary) {
        return; // 去重
    }
    traeAIState = state;
    traeAISummary = summary;

    const status: StatusPayload['status'] = state === 'idle' ? 'idle' : 'working';
    pushStatus({
        tool: resolvedToolName,
        status,
        summary: state === 'idle' ? 'AI idle' : `AI ${state}: ${summary}`,
    });
}

/**
 * 设置 Trae AI 空闲定时器（AI 操作停止后回 idle）
 */
function resetTraeAIIdleTimer() {
    if (traeAIIdleTimer) {
        clearTimeout(traeAIIdleTimer);
    }
    traeAIIdleTimer = setTimeout(() => {
        // 如果 AI 面板仍然可见，延长等待而非直接回 idle
        updateWebViewVisibility();
        if (traeWebviewVisible) {
            resetTraeAIIdleTimer();
            return;
        }
        pushTraeAIStatus('idle', '');
    }, 30000); // 30 秒无活动回 idle
}

/**
 * 检测 Trae AI 进程是否在运行
 * Trae 的 AI 功能使用 LLM 后端进程，通过进程名检测
 */
function checkTraeAIProcess(): boolean {
    try {
        // Windows: 查找 Trae 相关 AI 进程
        if (process.platform === 'win32') {
            const result = cp.execSync(
                'tasklist /FI "IMAGENAME eq Trae*" /FO CSV /NH',
                { timeout: 3000, encoding: 'utf-8' }
            );
            return result.toLowerCase().includes('trae');
        }
        // macOS/Linux: 查找 trae 进程
        const result = cp.execSync('pgrep -i trae', { timeout: 3000, encoding: 'utf-8' });
        return result.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * Trae AI 文件变更检测
 * AI Builder 模式会在短时间内修改多个文件，这是 AI 工作的强信号
 */
function onTraeFileChange(doc: vscode.TextDocument) {
    if (!isTraeIDE || !getConfig().traeAIMonitor) {
        return;
    }

    // 忽略 node_modules、.git 等
    const filePath = doc.fileName;
    if (filePath.includes('node_modules') || filePath.includes('.git') ||
        filePath.includes('.vscode') || filePath.includes('__pycache__')) {
        return;
    }

    traeFileChangeCount++;

    // 收到变更时立即重置 idle timer，避免 3s 等待期间被 idle timer 覆盖
    resetIdleTimer();
    if (traeAIState !== 'idle') {
        // AI 已在工作状态，直接延长 idle timer
        resetTraeAIIdleTimer();
    }

    // 清除之前的计数器
    if (traeFileChangeTimer) {
        clearTimeout(traeFileChangeTimer);
    }

    // 3 秒内累积的文件变更数
    traeFileChangeTimer = setTimeout(() => {
        const count = traeFileChangeCount;
        traeFileChangeCount = 0;

        if (count >= 2) {
            // 短时间内 2+ 文件变更 → AI Builder 模式
            pushTraeAIStatus('building', `${count} files changed`);
            resetTraeAIIdleTimer();
        } else if (count >= 1) {
            // 任何文件变更 → AI 可能正在操作
            pushTraeAIState('chatting', `Applying changes`);
            resetTraeAIIdleTimer();
        }
    }, 3000);
}

/**
 * 推送 Trae AI 状态（不改变 state，只推送当前状态）
 */
function pushTraeAIState(state: 'idle' | 'chatting' | 'building', summary: string) {
    if (state === traeAIState && summary === traeAISummary) {
        return;
    }
    traeAIState = state;
    traeAISummary = summary;

    const status: StatusPayload['status'] = state === 'idle' ? 'idle' : 'working';
    pushStatus({
        tool: resolvedToolName,
        status,
        summary: state === 'idle' ? 'AI idle' : `AI ${state}: ${summary}`,
    });
}

/**
 * 检测 AI Webview 面板是否活跃
 * 通过 tabGroups API 检查非文本编辑器标签页（如 webview、自定义编辑器）
 */
function updateWebViewVisibility(): void {
    try {
        const activeGroup = vscode.window.tabGroups.activeTabGroup;
        for (const tab of activeGroup.tabs) {
            if (tab.isActive) {
                traeWebviewVisible = !(tab.input instanceof vscode.TabInputText);
                return;
            }
        }
    } catch {
        // tabGroups API 可能不可用，回退到 activeTextEditor 检测
        traeWebviewVisible = !vscode.window.activeTextEditor;
    }
}

/**
 * 初始化 Trae AI 监控
 * 通过多种信号综合判断 AI 工作状态：
 * 1. Webview 面板可见性（AI Chat/Builder 面板）
 * 2. 文件变更模式（AI Builder 短时间修改多文件）
 * 3. 文档内容变更（AI 生成代码时的流式写入）
 * 4. 定期轮询检测 AI 活动信号
 */
function initTraeAIMonitor(context: vscode.ExtensionContext) {
    if (!isTraeIDE) {
        return;
    }

    // 1. 监听 webview 面板
    // Trae 的 AI 面板是 webview，通过 onDidChangeActiveEditor 检测
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (!editor) {
                // 可能切换到了 webview 面板（AI Chat）
                traeWebviewVisible = true;
                if (getConfig().traeAIMonitor && traeAIState === 'idle') {
                    pushTraeAIState('chatting', 'Chat panel active');
                    resetTraeAIIdleTimer();
                }
            } else {
                traeWebviewVisible = false;
            }
            // 通过 tabGroups 补充检测 webview 可见性
            updateWebViewVisibility();
        })
    );

    // 2. 监听文件变更模式（AI Builder 信号）
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            // 先走通用的编辑器事件
            onDidChangeTextDocument(event);
            // 再走 Trae AI 检测
            onTraeFileChange(event.document);
        })
    );

    // 3. 监听文件新建（AI Builder 常见操作）
    context.subscriptions.push(
        vscode.workspace.onDidCreateFiles((event) => {
            if (!getConfig().traeAIMonitor) {
                return;
            }
            const count = event.files.length;
            if (count >= 1) {
                const fileNames = event.files.map(f => getFileName(f.fsPath)).join(', ');
                pushTraeAIState('building', `Created: ${fileNames}`);
                resetTraeAIIdleTimer();
            }
        })
    );

    // 4. 监听文件删除（AI Builder 重构操作）
    context.subscriptions.push(
        vscode.workspace.onDidDeleteFiles((event) => {
            if (!getConfig().traeAIMonitor) {
                return;
            }
            const count = event.files.length;
            if (count >= 1) {
                pushTraeAIState('building', `Deleted ${count} file(s)`);
                resetTraeAIIdleTimer();
            }
        })
    );

    // 5. 监听终端输出（AI 执行命令）
    // Trae AI Builder 会运行终端命令
    const terminalDataBuffer: Map<string, string> = new Map();
    context.subscriptions.push(
        vscode.window.onDidOpenTerminal((terminal) => {
            // Trae AI 创建的终端通常有特定名称
            const name = terminal.name.toLowerCase();
            if (name.includes('trae') || name.includes('ai') || name.includes('agent')) {
                pushTraeAIState('building', `Running: ${terminal.name}`);
                resetTraeAIIdleTimer();
            }
        })
    );

    // 6. 定期轮询（兜底：检测 AI 活动信号）
    traePollInterval = setInterval(() => {
        if (!getConfig().traeAIMonitor || !getConfig().enabled) {
            return;
        }
        // 主动检测：更新 webview 可见性
        updateWebViewVisibility();
        // 如果 webview 可见且 AI 状态为 idle，可能是用户在等待 AI 响应
        if (traeWebviewVisible && traeAIState === 'idle') {
            pushTraeAIState('chatting', 'AI panel active');
            resetTraeAIIdleTimer();
        }
    }, 10000);

    context.subscriptions.push({
        dispose: () => {
            if (traePollInterval) {
                clearInterval(traePollInterval);
                traePollInterval = null;
            }
        }
    });

    // 7. 监听 Trae 特有的命令执行
    // Trae AI 执行编辑操作时会触发 onDidChangeTextDocument
    // 但我们可以通过检测变更来源来区分
    // 关键信号：短时间内同一文件大量变更（流式写入）
    let lastChangeTime = 0;
    let rapidChangeCount = 0;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (!getConfig().traeAIMonitor) {
                return;
            }
            const now = Date.now();
            if (now - lastChangeTime < 500) {
                rapidChangeCount++;
            } else {
                rapidChangeCount = 1;
            }
            lastChangeTime = now;

            // 500ms 内 3+ 次变更 → 流式代码生成
            if (rapidChangeCount >= 3) {
                const fileName = getFileName(event.document.fileName);
                pushTraeAIState('building', `Generating ${fileName}`);
                resetTraeAIIdleTimer();
                rapidChangeCount = 0;
            }
        })
    );

    vscode.window.showInformationMessage('DesktopXPet: Trae AI monitor activated');
}

// ============================================================
// 通用编辑器事件
// ============================================================

function onDidSaveTextDocument(doc: vscode.TextDocument) {
    const { enabled } = getConfig();
    if (!enabled) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    pushStatus({
        tool: resolvedToolName,
        status: 'working',
        summary: buildSummary(editor, 'save'),
    });
    resetIdleTimer();
}

function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
    const { enabled } = getConfig();
    if (!enabled) {
        return;
    }
    if (!editor) {
        return;
    }
    const filePath = editor.document.fileName;
    const fileName = getFileName(filePath);
    const lang = getLanguageId(filePath);
    const line = editor.selection.active.line + 1;
    lastEditorPath = filePath;

    pushStatus({
        tool: resolvedToolName,
        status: 'working',
        summary: `Editing ${fileName}:${line} (${lang})`,
    });
    resetIdleTimer();
}

function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
    const { enabled } = getConfig();
    if (!enabled) {
        return;
    }
    resetIdleTimer();
    if (currentStatus !== 'working') {
        const editor = vscode.window.activeTextEditor;
        pushStatus({
            tool: resolvedToolName,
            status: 'working',
            summary: buildSummary(editor),
        });
    }
}

function onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
    const { enabled } = getConfig();
    if (!enabled) {
        return;
    }
    resetIdleTimer();
}

function onDidChangeVisibleTextEditors(editors: readonly vscode.TextEditor[]) {
    const { enabled } = getConfig();
    if (!enabled) {
        return;
    }
    if (editors.length > 0) {
        const editor = editors[0];
        const filePath = editor.document.fileName;
        if (filePath !== lastEditorPath) {
            lastEditorPath = filePath;
            pushStatus({
                tool: resolvedToolName,
                status: 'working',
                summary: buildSummary(editor),
            });
        }
    }
    resetIdleTimer();
}

// ============================================================
// 扩展入口
// ============================================================

export function activate(context: vscode.ExtensionContext) {
    // 解析 toolName 和 IDE 类型
    resolvedToolName = getToolName();
    isTraeIDE = detectIDE() === 'trae';

    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'desktopxpet-monitor.status';
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand('desktopxpet-monitor.toggle', () => {
            const config = vscode.workspace.getConfiguration('desktopxpet-monitor');
            const current = config.get<boolean>('enabled', true);
            config.update('enabled', !current, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(
                `DesktopXPet Monitor ${!current ? 'enabled' : 'disabled'}`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('desktopxpet-monitor.status', () => {
            const { port, enabled } = getConfig();
            const aiStatus = isTraeIDE ? ` | AI: ${traeAIState}` : '';
            const msg = enabled
                ? `DesktopXPet Monitor: ${resolvedToolName} on port ${port} (Status: ${currentStatus}${aiStatus})`
                : 'DesktopXPet Monitor: Disabled';
            vscode.window.showInformationMessage(msg);
        })
    );

    // Trae AI 监控切换命令
    if (isTraeIDE) {
        context.subscriptions.push(
            vscode.commands.registerCommand('desktopxpet-monitor.toggleAI', () => {
                const config = vscode.workspace.getConfiguration('desktopxpet-monitor');
                const current = config.get<boolean>('traeAIMonitor', true);
                config.update('traeAIMonitor', !current, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    `DesktopXPet Trae AI Monitor ${!current ? 'enabled' : 'disabled'}`
                );
            })
        );
    }

    // 通用编辑器事件
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument)
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor)
    );
    // 注意：onDidChangeTextDocument 在 Trae AI 监控中已注册，
    // 如果是 Trae，在 initTraeAIMonitor 中会注册并调用 onDidChangeTextDocument
    if (!isTraeIDE) {
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument)
        );
    }
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(onDidChangeTextEditorSelection)
    );
    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors((editors) => {
            // 当可见编辑器变化时，更新 webview 可见性
            if (isTraeIDE) {
                updateWebViewVisibility();
            }
            onDidChangeVisibleTextEditors(editors);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('desktopxpet-monitor')) {
                resolvedToolName = getToolName();
                isTraeIDE = detectIDE() === 'trae';
                const { enabled } = getConfig();
                if (enabled) {
                    resetIdleTimer();
                    pushStatus({
                        tool: resolvedToolName,
                        status: 'idle',
                        summary: 'Monitor reconfigured',
                    });
                } else {
                    if (idleTimer) {
                        clearTimeout(idleTimer);
                        idleTimer = null;
                    }
                    statusBarItem.hide();
                }
            }
        })
    );

    // 初始化 Trae AI 监控
    if (isTraeIDE) {
        initTraeAIMonitor(context);
    }

    const { enabled } = getConfig();
    if (enabled) {
        resetIdleTimer();
        pushStatus({
            tool: resolvedToolName,
            status: 'idle',
            summary: `${resolvedToolName} monitor started`,
        });
    }
}

export function deactivate() {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    if (traeAIIdleTimer) {
        clearTimeout(traeAIIdleTimer);
        traeAIIdleTimer = null;
    }
    if (traeFileChangeTimer) {
        clearTimeout(traeFileChangeTimer);
        traeFileChangeTimer = null;
    }
    if (traePollInterval) {
        clearInterval(traePollInterval);
        traePollInterval = null;
    }
    for (const sub of subscriptions) {
        sub.dispose();
    }
    subscriptions = [];
}
