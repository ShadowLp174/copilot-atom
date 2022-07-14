'use babel';

import LibreCopilotAtomView from './libre-copilot-atom-view';
import { CompositeDisposable } from 'atom';

const { OpenAiRequest } = require("./Completions.js");
const { CopilotToken, Auth } = require("./Authentication.js");
const settings = require("./settings.json");
const GhostText = require("./GhostText.js");

export default {
  constructor() {
    this.libreCopilotAtomView = null;
    this.modalPanel = null;
    this.subscriptions = null;
  },

  activate() {
    this.libreCopilotAtomView = new LibreCopilotAtomView();
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.libreCopilotAtomView.getElement(),
      visible: false
    });

    this.auth = new Auth();
    this.ghostText = new GhostText();

    this.token = settings.token;
    this.copilotToken = new CopilotToken(settings.copilotToken);

    this.libreCopilotAtomView.on("submit", () => {
      this.authenticate();
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'libre-copilot-atom:toggle': () => this.toggle()
    }));
    this.subscriptions.add(atom.commands.add("atom-workspace", {
      "libre-copilot-atom:full-panel-completions": () => this.fetchPanelCompletions()
    }));

    if (!this.isAuthenticated()) this.startAuth();

    this.editorListener = null;
    this.activeEditor = null;
    atom.workspace.onDidChangeActiveTextEditor((e) => {
      this.activeEditor = e;
    })
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.libreCopilotAtomView.destroy();
  },

  serialize() { // TODO
    return {
      libreCopilotAtomViewState: this.libreCopilotAtomView.serialize()
    };
  },

  toggle() {
    console.log('LibreCopilotAtom was toggled!');
    getMultiLineCompletion();
    /*return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );*/
  },

  startAuth() {
    var openWebsite = () => {
      this.modalPanel.show();
      this.auth.openDeviceCodePrompt();
      this.auth.startAuthFlow().then(data => {
        this.deviceCode = data.device_code;
        this.libreCopilotAtomView.updateDeviceCode(data.user_code);
        this.libreCopilotAtomView.btn.disabled = false;
      });
    }
    let notification = atom.notifications.addWarning("Log in to Copilot", {
      buttons: [
        {
          onDidClick: () => {
            notification.dismiss();
            openWebsite();
          },
          text: "login"
        }
      ],
      dismissable: false,
      description: "You need to log in with your GitHub account to use Copilot. Click 'Login' to continue."
    })
  },
  authenticate() {
    this.modalPanel.hide();
    this.libreCopilotAtomView.reset();
    atom.notifications.addInfo("Aquiring GitHub access token...");
    this.auth.getAccessToken({ device_code: this.deviceCode }).then((data) => {
      this.token = data.access_token;
      this.auth.saveGithubAccessToken(data.access_token, "./settings.json");
      atom.notifications.addInfo("Fetching GitHub copilot access token...");
      this.auth.refreshCopilotToken(this.token, "./settings.json").then((cToken) => {
        atom.notifications.addSuccess("Aquired all necessary data!", { description: "You can now use GitHub Copilot in Atom!" });
        this.copilotToken = cToken;
      });
    });
  },
  isAuthenticated() {
    return (this.token) ? true : false;
  },

  async fetchPanelCompletions() {
    if (!this.isAuthenticated()) return this.startAuth();
    let token = this.copilotToken;
    if (token.isExpired()) {
      atom.notifications.addInfo("Refreshing Copilot Token");
      token = await auth.refreshCopilotToken(this.token, "./settings.json");
      this.copilotToken = token;
      atom.notifications.addInfo("Refreshed! Now using: `" + token.token + "`");
    }
    const request = new OpenAiRequest({ auth: { copilotToken: token.token }});
    console.log(request)
    atom.workspace.open("", {split: "right"}).then((editor) => {
      editor.setText("Loading completions...");
      request.executePanelRequest(10).then(async res => {
        const completions = await this.parseCopilotResponse(res, 10, false);
        console.log(completions);
        editor.setText(completions.join("\n\n/////////////////////////////\n\n"));
      })
    });
  },

  async parseCopilotResponse(res, n=1, trim=false) {
    let body = res.body;
    const reader = body.getReader();
    var completions = "";
    while (true) {
      let data = await reader.read();
      if (data.done) break;
      completions += (new TextDecoder()).decode(data.value);
    }
    completions = completions.split("\n\n");
    completions = completions.slice(0, completions.length - 2);
    completions = completions.map(el => JSON.parse(el.split("data: ")[1]));
    const data = [];
    for (let i = 0; i < n; i++) {
      const completion = completions.filter((el) => el.choices[0].index == n - 1).reduce((prev, curr) => {
        if (typeof prev != "string") return curr.choices[0].text;
        return prev + curr.choices[0].text;
      });
      data.push((trim) ? completion.replace("\n\n", "\n").substring(0, completion.trim().indexOf("\n\n") + 1) : completion);
    }
    return (n == 1) ? data[0] : data;
  },
};

// divide a through b

const text = new GhostText();
const auth = new Auth();
var token = new CopilotToken(settings.copilotToken);

async function getMultiLineCompletion() {
  if (token.isExpired()) {
    atom.notifications.addInfo("Refreshing Copilot Token");
    token = await auth.refreshCopilotToken(settings.token, "./settings.json");
    atom.notifications.addInfo("Refreshed! Now using: `" + token.token + "`");
  }
  atom.notifications.addInfo("Sending request...");
  const request = new OpenAiRequest({ auth: { copilotToken: token.token }});
  request.executeInlayMultiLineRequest().then(async res => {
    console.log(res);
    let body = res.body;
    const reader = body.getReader();
    var completions = "";
    while (true) {
      let data = await reader.read();
      if (data.done) break;
      completions += (new TextDecoder()).decode(data.value);
    }
    completions = completions.split("\n\n");
    completions = completions.slice(0, completions.length - 2);
    completions = completions.map(el => JSON.parse(el.split("data: ")[1]));
    const data = completions.reduce((prev, curr) => {
      if (typeof prev != "string") return curr.choices[0].text;
      return prev + curr.choices[0].text;
    });
    console.log(data);
    let ghost = text.insertAtCursor(data.replace("\n\n", "\n").substring(0, data.trim().indexOf("\n\n") + 1));//.replace(/\n\n/gi, "\n"));
    text.synthesize(ghost);
  })
}
