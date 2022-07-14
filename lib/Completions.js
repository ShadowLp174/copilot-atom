class Completions { // intellij Copilot: OpenAIServiceImpl --> main endpoints line 102; CopilotEditorManagerImpl --> text fetch
  constructor() {
    return this;
  }

  static TYPE = {
    GHOST: "copilot-ghost",
    PANEL: "copilot-panel"
  }
  static OPENAI = {
    ORGANIZATION: "github-copilot",
    staticHeaders: {
      "Editor-Plugin-Version": "copilot/1.31.6194",
      "Editor-Version": "vscode/1.68.1"
    }
  }
  static url = "https://copilot-proxy.githubusercontent.com";
  static topP = 1;
  static engines = {
    "default": "/v1/engines/copilot-codex"
  }
  static getEngine(language) {
    if (!language || Object.keys(this.engines).length <= 1) return this.engines.default;
  }
  static getUrl(language) {
    return this.url + Completions.getEngine(language) + "/completions";
  }
  static getTemperature(sampleCount) {
    if (sampleCount <= 1) {
      return 0;
    } else if (sampleCount <= 10) {
      return 0.2;
    } else if (sampleCount < 20) {
      return 0.4;
    }
    return 0.8;
  }

  fetchCompletions() {

  }
}

class AtomEditor {
  constructor() {
    return this;
  }
  static maxTokens = 500;
  static maxPromptLength = 2048 - AtomEditor.maxTokens; // max tokens - requestedTokens; 2048 for cushman, 4096 for davinci

  getPanelInput(promptTokens) { // TODO: Finish
    //const editor = atom.workspace.getActiveTextEditor();
    const editor = this.editor;

    let budget = AtomEditor.maxPromptLength - promptTokens.length;
    let position = editor.getCursorScreenPosition();
    let text = editor.getBuffer().getTextInRange([[0,0], [position.row, position.column]]);
    if (text.length < budget) return text;
    return text.substring(text.length - budget, text.length - 1);
  }
  getCoherentCommentsBySelector() {

  }
}

class Editor extends AtomEditor {
  constructor(editor) {
    super();
    this.editor = (editor) ? editor : atom.workspace.getActiveTextEditor();
    return this;
  }
  getRelativeFilePath() {
    var path = this.editor.getPath();
    var rootDir = atom.project.rootDirectories.find(el => path.includes(el.path));
    return "." + path.substring(rootDir.path.length, path.length).replace(/\\/gi, "/");
  }
  getFilePath() {
    return this.editor.getPath();
  }
  getRootDir(filePath) {
    return atom.project.rootDirectories.find(el => filePath.includes(el.path));
  }
  getLanguage() {
    return this.editor.getGrammar().name.toLowerCase();
  }
  static getLanguage(e) {
    return e.getGrammar().name.toLowerCase();
  }
}

class OpenAiRequestBody { // see completions: https://beta.openai.com/docs/api-reference/completions
  constructor(prompt="", completionCount=1, maxTokens=Editor.maxTokens, temperature=0, topP=1, stream=true, stops=null, logprobs=2, language="", suffix="") {
    this.prompt = prompt;
    this.completionCount = completionCount;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.topP = topP;
    this.stream = stream;
    this.stops = stops // e.g.: ["\n"] --> position where the completion will end
    this.logprobs = logprobs;
    this.language = language;
    this.suffix = suffix;

    return this;
  }
  getHttpBody() {
    return {
      extra: {
        language: this.language,
        next_indent: 0
      },
      prompt: this.prompt,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      top_p: this.topP,
      n: this.completionCount,
      logprobs: this.logprobs,
      stream: this.stream,
      stop: this.stops,
      suffix: this.suffix
    }
  }
}

class OpenAiRequest {
  constructor(data) {
    this.editor = new Editor();
    this.auth = data.auth;
    this.body = data.body
    this.completionTypeGhost = Completions.TYPE.GHOST;
    this.completionTypePanel = Completions.TYPE.PANEL;
    this.orga = Completions.OPENAI.ORGANIZATION;

    return this;
  }
  getPrompt() {
    let lang = "// Language: " + this.editor.getLanguage() + "\n";
    let path = "// Path: " + this.editor.getRelativeFilePath() + "\n";
    let input = this.editor.getPanelInput(lang + path);
    return lang + path + input;
  }
  getHeaders(ghost) {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + this.auth.copilotToken,
      "OpenAI-Intent": (ghost) ? this.completionTypeGhost : this.completionTypePanel,
      "Openai-Organization": this.orga,
      ...Completions.OPENAI.staticHeaders,
      //"X-Request-Id": "someId"
    }
  }
  executeInlayMultiLineRequest() {
    this.body = new OpenAiRequestBody(this.getPrompt(), 1, Editor.maxTokens, Completions.getTemperature(1), 1, true, null, null, this.editor.getLanguage());
    return fetch(Completions.getUrl(Editor.getLanguage(this.editor.editor)), {
      method: "POST",
      headers: this.getHeaders(true),
      body: JSON.stringify(this.body.getHttpBody())
    });
  }
  executeInlaySingleLineRequest() {
    this.body = new OpenAiRequestBody(this.getPrompt(), 1, Editor.maxTokens, Completions.getTemperature(1), 1, true, ["\n"], null, this.editor.getLanguage());
    return fetch(Completions.getUrl(Editor.getLanguage(this.editor.editor)), {
      method: "POST",
      headers: this.getHeaders(true),
      body: JSON.stringify(this.body.getHttpBody())
    });
  }
  executePanelRequest(n) {
    this.body = new OpenAiRequestBody(this.getPrompt(), n, Editor.maxTokens / 1, Completions.getTemperature(n), 1, true, ["\n\n\n"], null, this.editor.getLanguage());
    return fetch(Completions.getUrl(Editor.getLanguage(this.editor.editor)), {
      method: "POST",
      headers: this.getHeaders(false),
      body: JSON.stringify(this.body.getHttpBody())
    });
  }
}

module.exports = { Completions, Editor, OpenAiRequest, OpenAiRequestBody };
