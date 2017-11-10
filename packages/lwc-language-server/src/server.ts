import {
    createConnection,
    IConnection,
    TextDocuments,
    InitializeParams,
    InitializeResult,
    TextDocumentPositionParams,
    CompletionItem,
    Files,
} from 'vscode-languageserver';

import templateLinter from './template/linter';
import javascriptLinter from './javascript/linter';
import templateCompletionProvider from './template/completion';

import { isTemplate, isJavascript } from './utils';

// Create a standard connection and let the caller decide the strategy
// Availalble startegies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let workspaceRoot: string;
connection.onInitialize((params: InitializeParams): InitializeResult => {
    const { rootUri, rootPath } = params;

    // Early exit if no workspace is opened
    const root = rootUri ? Files.uriToFilePath(rootUri) : rootPath;
    if (!root) {
        console.log(`No workspace found`);
        return { capabilities: {} };
    }

    workspaceRoot = root;
    console.log(`Starting language server at ${workspaceRoot}`);

    // Return the language server capabilities
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
});

// Make sure to clear all the diagnostics when a document gets closed
documents.onDidClose(event => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.onDidChangeContent(change => {
    const { document } = change;
    if (isTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    } else if (isJavascript(document)) {
        const diagnostics = javascriptLinter(document);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    }
});

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        return isTemplate(document)
            ? templateCompletionProvider(
                  document,
                  textDocumentPosition.position,
              )
            : [];
    },
);

// Listen on the connection
connection.listen();
