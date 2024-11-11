"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
//import fetch from 'node-fetch';
function activate(context) {
    let currentProjectPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
    let disposable = vscode.commands.registerCommand('fileguide.openCustomInput', () => {
        console.log("hello");
        console.log('Opening custom input webview321321');
        const panel = vscode.window.createWebviewPanel('customInput', 'Custom Input', vscode.ViewColumn.One, { enableScripts: true });
        panel.webview.html = getWebviewContent(currentProjectPath, []);
        panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message from webview:', message);
            switch (message.command) {
                case 'analyze':
                    processProjectFolder(currentProjectPath, 10, message);
                    const fileTree = await generateFileTree(currentProjectPath);
                    //console.log(fileTree);
                    panel.webview.html = getWebviewContent(currentProjectPath, fileTree);
                    break;
                case 'changeProject':
                    vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Project Folder'
                    }).then(folderUri => {
                        if (folderUri && folderUri[0]) {
                            currentProjectPath = folderUri[0].fsPath;
                            panel.webview.html = getWebviewContent(currentProjectPath, []);
                        }
                    });
                    break;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
function getWebviewContent(currentProjectPath, fileTreeHTML) {
    const fileListHTML = fileTreeHTML.join(''); // Join without commas
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Guide</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    text-align: center;
                }
                h1 {
                    font-size: 36px;
                    margin-bottom: 20px;
                }
                textarea {
                    width: 80%;
                    height: 150px;
                    padding: 10px;
                    font-size: 16px;
                    border-radius: 10px;
                    border: 1px solid #ccc;
                    background-color: #342c2a; /* Darker gray */
                }
                button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    font-size: 16px;
                    border-radius: 5px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                #fileTree {
                    width: 80%;
                    background-color: #342c2a; /* Darker gray */
                    border: 1px solid #ccc;
                    padding: 15px;
                    margin: 20px auto;
                    text-align: left; /* Align the text to the left */
                }
                ul {
                    list-style-type: none;
                    padding-left: 20px;
                }
                li {
                    cursor: pointer;
                    font-size: 16px;
                    margin: 5px 0;
                }
                li.directory {
                    font-weight: bold;
                }
                li.collapsed:before {
                    content: '[+] ';
                }
                li.expanded:before {
                    content: '[-] ';
                }
                li.file:before {
                    content: '📄 ';
                }
            </style>
        </head>
        <body>
            <h1>File Guide</h1>
            <p id="currentProject">Current Project: ${currentProjectPath}</p>
            <button id="changeProjectButton">Change Project</button>
            <br /><br />
            <textarea id="userInput" placeholder="Enter task description here..."></textarea>
            <br />
            <button id="submitButton">Submit</button>
            <div id="fileTree">
                <ul id="fileList">${fileListHTML}</ul> <!-- Use the joined string here -->
            </div>

            <script>

               
                const vscode = acquireVsCodeApi();

                // Submit button logic
                document.getElementById('submitButton').addEventListener('click', () => {
                    const input = document.getElementById('userInput').value;
                    vscode.postMessage({
                        command: 'analyze',
                        text: input
                    });
                });

                // Change project button logic
                document.getElementById('changeProjectButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'changeProject'
                    });
                });

                // Collapse/Expand directories
                document.querySelectorAll('li.directory').forEach(directory => {
                    directory.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const isCollapsed = directory.classList.contains('collapsed');
                        const subItems = document.querySelectorAll(\`[data-parent="\${directory.dataset.path}"]\`);

                        if (isCollapsed) {
                            // Expand
                            subItems.forEach(item => item.style.display = 'list-item');
                            directory.classList.remove('collapsed');
                            directory.classList.add('expanded');
                        } else {
                            // Collapse
                            subItems.forEach(item => item.style.display = 'none');
                            directory.classList.remove('expanded');
                            directory.classList.add('collapsed');
                        }
                    });
                });
                // Event listener for pressing "Enter" key
                document.getElementById('userInput').addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Prevent the default action of adding a new line in the textarea
                        const input = document.getElementById('userInput').value;
                    vscode.postMessage({
                        command: 'analyze',
                        text: input
                    });
                    }
                });
            </script>
        </body>
        </html>
    `;
}
async function processProjectFolder(projectPath, batchSize = 10, userMessage) {
    const fileData = [];
    function traverseDirectory(directory) {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                traverseDirectory(fullPath); // Recursively traverse subdirectories
            }
            else {
                const fileDetails = extractFileDetails(fullPath);
                fileData.push({ content: fileDetails });
            }
        });
    }
    function getFileLanguage(filePath) {
        const extension = path.extname(filePath);
        switch (extension) {
            case '.js': return 'JavaScript';
            case '.ts': return 'TypeScript';
            case '.py': return 'Python';
            case '.java': return 'Java';
            case '.cpp': return 'C++';
            case '.rb': return 'Ruby';
            // NEED MORE CASES
            default: return 'Unknown';
        }
    }
    function extractFileDetails(filePath) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const language = getFileLanguage(filePath);
        let details;
        switch (language) {
            case 'JavaScript':
            case 'TypeScript':
                //details = extractJSDetails(fileContent, filePath);
                break;
            case 'Python':
                details = extractPythonDetails(fileContent, filePath);
                //console.log(details);
                break;
            // ADDITIONAL CASES FOR OTHER LANGUAGES
            default:
                details = `Path: ${filePath}, Language: ${language}, Message: Language not supported for detailed extraction`;
        }
        return typeof details === 'string' ? details : formatFileDetails(details);
    }
    function formatFileDetails(details) {
        if (!details) {
            return 'File details are unavailable';
        }
        /*console.log(`
    Path: ${details.filePath}, Language: ${details.language}
    
    File Structure Summary:
    ${details.fileStructureSummary}
    
    Imports:
    ${details.imports.join(', ')}
    
    Functions:
    ${details.functions.map(func => `Name: ${func.name}, Params: (${func.params}), Comments: ${func.comments.join(' ')}`).join('\n')}
    
    Classes:
    ${details.classes.map(cls => `Name: ${cls.name}, Comments: ${cls.comments.join(' ')}`).join('\n')}
    
    Variables:
    ${details.exports.join(', ')}
    `.trim());*/
        return `
    Path: ${details.filePath}, Language: ${details.language}
    
    File Structure Summary:
    ${details.fileStructureSummary}
    
    Imports:
    ${details.imports.join(', ')}
    
    Functions:
    ${details.functions.map(func => `Name: ${func.name}, Params: (${func.params}), Comments: ${func.comments.join(' ')}`).join('\n')}
    
    Classes:
    ${details.classes.map(cls => `Name: ${cls.name}, Comments: ${cls.comments.join(' ')}`).join('\n')}
    
    Variables:
    ${details.exports.join(', ')}
    `.trim();
    }
    function extractPythonDetails(fileContent, filePath) {
        const fileSize = Buffer.byteLength(fileContent, 'utf-8');
        // Extract imports
        const imports = fileContent.match(/(?:import|from)\s+\w+/g) || [];
        // Update to capture all functions (any line starting with `def`)
        const functions = Array.from(fileContent.matchAll(/def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*\w+)?\s*:\s*((?:"""[\s\S]*?"""|'''\s*[\s\S]*?'''|#.*(?:\n#.*)*)?)/g)).map(match => ({
            name: match[1],
            params: match[2],
            comments: Array.from(new Set((match[3]?.match(/(""".*?"""|'''.*?'''|#.*(?:\n#.*)*)/s) || []).map(comment => comment.trim())))
        }));
        // Extract classes with comments
        const classes = Array.from(fileContent.matchAll(/class\s+(\w+)\s*(?:\(\w+\))?:\s*([\s\S]*?(?=\bclass\b|\bdef\b|\Z))/g)).map(match => ({
            name: match[1],
            comments: (match[2].match(/""".*?"""|'''.*?'''|#.*(?:\n#.*)*/s) || [])
                .map(comment => comment.trim())
        }));
        // Extract exports
        const exports = fileContent.match(/^\s*\w+\s*=\s*.+/gm) || [];
        // File structure summary
        const fileStructureSummary = `
        Imports: ${imports.length} items
        Classes: ${classes.length} items
        Functions: ${functions.length} items
        Exports: ${exports.length} items
        FileSize: ${fileSize} bytes
        `;
        return {
            filePath,
            language: 'Python',
            imports: imports,
            functions: functions,
            classes: classes,
            exports: exports,
            fileStructureSummary: fileStructureSummary.trim()
        };
    }
    // NEED MORE SPECIFIC LANGUAGE DETAIL FUNCTIONS
    // Collect relevant data from project files
    traverseDirectory(projectPath);
    //console.log(fileData);
    // Prepare data in batches in order to make less API calls
    //for (let i = 0; i < fileData.length; i++) {
    //    console.log(await fetchEmbeddingsBatch(fileData[i].content));
    //}
    console.log("test");
    const { CohereClient } = require('cohere-ai');
    const cohere = new CohereClient({
        token: 'w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV',
    });
    (async () => {
        const embed = await cohere.v2.embed({
            texts: ['hello', 'goodbye'],
            model: 'embed-english-v3.0',
            inputType: 'classification',
            embeddingTypes: ['float'],
        });
        console.log(embed);
    })();
}
async function generateFileTree(dir, level = 0) {
    let files = [];
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            // Load the directory name, but collapse its contents by default
            const dirPath = path.join(dir, item.name);
            const subFiles = await generateFileTree(dirPath, level + 1); // Recursively load sub-files
            files.push(`<ul>${subFiles.join('')}</ul>`); // Wrap sub-files in an unordered list
            files.push(`<li class="directory collapsed" data-path="${dirPath}">${item.name}/</li>`);
        }
        else {
            // Add files at the current level
            files.push(`<li class="file">${item.name}</li>`);
        }
    }
    // Reverse the files array to change the order
    return files;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map