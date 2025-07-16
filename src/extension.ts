// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitExtension, API, Repository } from './types/git';
import GetCommitTypes, { CommitType } from './config/commit-type';
import {
    GetCommitDetailType,
    CommitDetailQuickPickOptions,
    MaxSubjectCharacters,
    CommitDetailType,
    FillSubjectWithCurrent,
} from './config/commit-detail';
import GetCommitInputType, { CommitInputType } from './config/commit-input';
import CommitTemplate from './config/template-type';
import { Angular } from './config/default-temp';
export interface GitMessage {
    [index: string]: string;
    templateName: string;
    templateContent: string;
    icon: string;
    type: string;
    scope: string;
    subject: string;
    body: string;
    footer: string;
}

import { localize, init } from 'vscode-nls-i18n';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    init(context.extensionPath);

    const CommitType: Array<CommitType> = GetCommitTypes();
    const CommitDetailType: Array<CommitDetailType> = GetCommitDetailType();
    const CommitInputType: CommitInputType = GetCommitInputType();

    //获取是否在git扩展内 Gets whether it is in the git extension
    function getGitExtension() {
        return vscode.extensions.getExtension<GitExtension>('vscode.git')?.activate();
    }
    //Commit message config
    const message_config: GitMessage = {
        templateName: '',
        templateContent: '',
        icon: '',
        type: '',
        scope: '',
        subject: '',
        body: '',
        footer: '',
    };
    //清除填写信息 Clear message
    function clearMessage() {
        Object.keys(message_config).forEach(key => (message_config[key] = ''));
        CommitDetailType.map(item => {
            item.isEdit = false;
            return item;
        });
    }
    //组合信息 Portfolio information
    function messageCombine(config: GitMessage) {
        let result = config.templateContent || Angular.templateContent;
        result = config.icon
            ? result.replace(/<icon>/g, config.icon)
            : result.replace(/<icon>/g, '');
        result =
            config.type !== ''
                ? result.replace(/<type>/g, config.type)
                : result.replace(/<type>/g, '');
        result =
            config.scope !== ''
                ? result.replace(/<scope>/g, config.scope)
                : result.replace(/\(?<scope>\)?/g, '');
        result =
            config.subject !== ''
                ? result.replace(/<subject>/g, config.subject)
                : result.replace(/<subject>/g, '');
        result =
            config.body !== ''
                ? result.replace(/<body>/g, config.body)
                : result.replace(/<body>/g, '');
        result =
            config.footer !== ''
                ? result.replace(/<footer>/g, config.footer)
                : result.replace(/<footer>/g, '');
        result = result.replace(/<enter>/g, '\n\n');
        result = result.replace(/<space>/g, ' ');
        result = result.replace(/<br>/g, '\n');
        
        return result.trim();
    }

    const gitExtension = await getGitExtension();

    if (!gitExtension?.enabled) {
        vscode.window.showErrorMessage(
            'Git extensions are not currently enabled, please try again after enabled!',
        );
        return false;
    }

    //获取当前的 git仓库实例 Get git repo instance
    let repo: any = gitExtension.getAPI(1).repositories[0];

    //输入提交详情 Input message detail
    const inputMessageDetail = (_key: string | number) => {
        const _detailType = CommitDetailType.find(item => item.key === _key);
        CommitInputType.prompt = `${_detailType?.description} 👉 ${_detailType?.detail}`;
        CommitInputType.value = message_config[_key] || '';
        if (_key === 'subject' && FillSubjectWithCurrent) {
            CommitInputType.value = message_config[_key] || '';
        }
        vscode.window.showInputBox(CommitInputType).then(value => {
            const _value = value || '';
            message_config[_key] = _value;
            _detailType && (_detailType.isEdit = true);
            if (_key === 'subject') {
                const input_value_length = value ? value.length : 0;
                if (input_value_length > MaxSubjectCharacters) {
                    vscode.window.showErrorMessage(
                        `The commit overview is no more than ${MaxSubjectCharacters} characters but the current input is ${input_value_length} characters`,
                        ...['ok'],
                    );
                    inputMessageDetail(_key);
                    return false;
                }
            }
            recursiveInputMessage(startMessageInput);
        });
    };
    //是否存在模板 If has template
    const existTemplate = () => {
        return Array.isArray(CommitTemplate) && CommitTemplate.length > 0;
    };
    //拷贝提交信息 Copy commit message
    const copyMessage = () => {
        vscode.env.clipboard.writeText(messageCombine(message_config));
        vscode.window.showInformationMessage(
            localize('extension.commitDetailType.message.copy.tip'),
            ...['ok'],
        );
        clearMessage();
    };
    //完成输入 Complete input message
    const completeInputMessage = (select?: boolean) => {
        vscode.commands.executeCommand('workbench.view.scm');
        if (existTemplate() && !select) {
            const defaultTemp = CommitTemplate.find(item => item.default);
            if (defaultTemp !== undefined) {
                message_config.templateName = defaultTemp.templateName;
                message_config.templateContent = defaultTemp.templateContent;
            }
        }
        repo.inputBox.value = messageCombine(message_config);
    };
    // 递归输入信息 Recursive input message
    const recursiveInputMessage = (startMessageInput?: () => void) => {
        CommitDetailQuickPickOptions.placeHolder = localize(
            'extension.showGitCommit.description.placeholder',
        );

        const _CommitDetailType: Array<CommitDetailType> = JSON.parse(
            JSON.stringify(CommitDetailType),
        );
        _CommitDetailType.map((item: any) => {
            if (item.isEdit) {
                item.description = `${item.description} 👍 >> ${message_config[item.key || '']
                }`;
            }
            return item;
        });
        vscode.window
            .showQuickPick(_CommitDetailType, CommitDetailQuickPickOptions)
            .then(select => {
                const label = (select && select.label) || '';
                if (label !== '') {
                    const _key = select?.key || 'body';
                    if (_key === 'complete') {
                        completeInputMessage();
                        clearMessage();
                        return false;
                    }
                    if (_key === 'back') {
                        startMessageInput && startMessageInput();
                        clearMessage();
                        return false;
                    }
                    if (_key === 'template') {
                        SelectTemplate();
                        return false;
                    }

                    if (_key === 'copy') {
                        copyMessage();
                        return false;
                    }
                    inputMessageDetail(_key);
                } else {
                    clearMessage();
                }
            });
    };
    //开始输入 Start input
    const startMessageInput = () => {
        CommitDetailQuickPickOptions.placeHolder = localize(
            'extension.showGitCommit.placeholder',
        );

        vscode.window
            .showQuickPick(CommitType, CommitDetailQuickPickOptions)
            .then(select => {
                let label = (select && select.label) || '';
                const icon = (select && select.icon) || '';
                if (typeof icon === 'string' && icon.length > 0) {
                    label = label.split(' ')[1];
                }
                message_config.type = label;
                message_config.icon = icon;
                if (label !== '') {
                    recursiveInputMessage(startMessageInput);
                }
            });
    };
    //选择commit 提交的模板
    const SelectTemplate = () => {
        CommitDetailQuickPickOptions.placeHolder = localize(
            'extension.showGitCommit.selectTemplate.placeholder',
        );
        vscode.window
            .showQuickPick(CommitTemplate, CommitDetailQuickPickOptions)
            .then(select => {
                const templateName = (select && select.templateName) || '';
                const templateContent = (select && select.templateContent) || '';
                message_config.templateName = templateName;
                message_config.templateContent = templateContent;
                if (templateName !== '') {
                    completeInputMessage(true);
                    clearMessage();
                }
            });
    };
    // 设置 detail 信息
    const setMessageInput = (_key: keyof GitMessage, message: string) => {
        const _detailType = CommitDetailType.find(item => item.key === _key);
        if(!_detailType || message.length <= 0) {return;}
        message_config[_key] = message;
        _detailType.isEdit = true;
    };
    //点击图标触发快捷选项 Click the icon to trigger shortcut options
    let disposable = vscode.commands.registerCommand(
        'extension.showGitCommit',
        async (uri?: vscode.Uri) => {
            // 获取激活的 git 扩展
            const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
            if (!gitExtension) {
                vscode.window.showErrorMessage('Git 扩展未激活');
                return;
            }

            // 获取 Git API
            const api: API = gitExtension.getAPI(1);
            if (!api) {
                vscode.window.showErrorMessage('无法获取 Git API');
                return;
            }

            // 选第一个仓库作为默认
            let repo: Repository | undefined = api.repositories[0];
            if (!repo) {
                vscode.window.showErrorMessage('未找到 Git 仓库');
                return;
            }

            // 如果有 uri，找到对应的仓库
            if (uri) {
                const uriRoot = (uri as any)._rootUri ?? uri;
                const foundRepo = api.repositories.find(r => r.rootUri.path === uriRoot.path);
                if (foundRepo) {
                    repo = foundRepo;
                }
            }

            // 取当前提交输入框内容（去空格）
            const currentInput: string = repo.inputBox.value?.trim() ?? '';

            if (currentInput.length > 0) {
            // 从配置中获取所有提交类型，包括 icon
                const commitTypes: CommitType[] = GetCommitTypes();

                // 构造 prefix -> emoji 映射，取 icon 字符
                const emojiMap: Record<string, string> = {};
                commitTypes.forEach(ct => {
                    if (ct.key && ct.icon) {
                        emojiMap[ct.key] = ct.icon.trim();
                    }
                });

                // 遍历映射，匹配输入框前缀
                for (const prefix in emojiMap) {
                    const emoji = emojiMap[prefix];
                    const regex = new RegExp(`^${prefix}`, 'i');
                    // 如果输入以 prefix 开头且尚未带 emoji，则添加 emoji
                    if (regex.test(currentInput) && !currentInput.startsWith(emoji)) {
                        repo.inputBox.value = `${emoji} ${currentInput}`;
                        vscode.window.showInformationMessage(`已添加表情：${emoji}`);
                        return;
                    }
                }

                // 如果已有表情或不匹配，提示无需更改
                vscode.window.showInformationMessage('已存在提交信息，无需更改');
                return;
            }

            // 输入为空，走原始交互流程
            if (FillSubjectWithCurrent) {
                const message = repo.inputBox.value;
                setMessageInput('subject', message);
            }

            startMessageInput();
        },
    );

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
