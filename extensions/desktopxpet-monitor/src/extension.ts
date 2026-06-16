import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

function getConfig() {
    const config = vscode.workspace.getConfiguration('desktopxpet-monitor');
    const port = config.get<number>('serverPort', 9527);
    const token = config.get<string>('serverToken', '') || readTokenFromConfig();
    const idleTimeout = config.get<number>('idleTimeout', 60);
    const enabled = config.get<boolean>('enabled', true);
    return { port, token, idleTimeout, enabled };
}

function readTokenFromConfig(): string {
    try {
        const configPath = path.join(os.homedir(), '.xpet', 'config.json');
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(data);
            return parsed.token || '';
        }
    } catch {
        // silent
    }
    return '';
}

function getFileName(filePath: string): string {
    return path.basename(filePath);
}

function getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
        '.ts': 'TypeScript',
        '.js': 'JavaScript',
        '.tsx': 'TypeScript React',
        '.jsx': 'JavaScript React',
        '.py': 'Python',
        '.java': 'Java',
        '.go': 'Go',
        '.rs': 'Rust',
        '.c': 'C',
        '.cpp': 'C++',
        '.h': 'C/C++ Header',
        '.cs': 'C#',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.json': 'JSON',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.md': 'Markdown',
        '.sql': 'SQL',
        '.sh': 'Shell',
        '.bat': 'Batch',
        '.ps1': 'PowerShell',
    };
    return map[ext] || ext.slice(1) || 'Unknown';
}

function updateStatusBar(status: StatusPayload['status']) {
    if (!statusBarItem) {
        return;
    }
    switch (status) {
        case 'working':
            statusBarItem.text = '$(sync~spin) XPet: Working';
            statusBarItem.tooltip = 'DesktopXPet - Connected (Working)';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'idle':
            statusBarItem.text = '$(circle-outline) XPet: Idle';
            statusBarItem.tooltip = 'DesktopXPet - Connected (Idle)';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'error':
            statusBarItem.text = '$(warning) XPet: Error';
            statusBarItem.tooltip = 'DesktopXPet - Connection Error';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
        case 'completed':
            statusBarItem.text = '$(check) XPet: Done';
            statusBarItem.tooltip = 'DesktopXPet - Completed';
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
        pushStatus({
            tool: 'cursor',
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

function onDidSaveTextDocument(doc: vscode.TextDocument) {
    const { enabled } = getConfig();
    if (!enabled) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    pushStatus({
        tool: 'cursor',
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
        tool: 'cursor',
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
            tool: 'cursor',
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
                tool: 'cursor',
                status: 'working',
                summary: buildSummary(editor),
            });
        }
    }
    resetIdleTimer();
}

export function activate(context: vscode.ExtensionContext) {
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
            const msg = enabled
                ? `DesktopXPet Monitor: Connected on port ${port} (Status: ${currentStatus})`
                : 'DesktopXPet Monitor: Disabled';
            vscode.window.showInformationMessage(msg);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument)
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor)
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument)
    );
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(onDidChangeTextEditorSelection)
    );
    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(onDidChangeVisibleTextEditors)
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('desktopxpet-monitor')) {
                const { enabled } = getConfig();
                if (enabled) {
                    resetIdleTimer();
                    pushStatus({
                        tool: 'cursor',
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

    const { enabled } = getConfig();
    if (enabled) {
        resetIdleTimer();
        pushStatus({
            tool: 'cursor',
            status: 'idle',
            summary: 'Monitor started',
        });
    }
}

export function deactivate() {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    for (const sub of subscriptions) {
        sub.dispose();
    }
    subscriptions = [];
}
