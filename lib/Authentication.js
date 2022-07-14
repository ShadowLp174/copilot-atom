const path = require("path");
const fs = require("fs");
const { shell } = require("electron");

class CopilotToken {
  constructor(token) {
    if (!token) return null;
    this.token = token;

    token = token.split(";").map(el => el.split("="));
    this.data = {};
    token.forEach((el) => {
      this.data[el[0]] = el[1];
    });
    this.data.exp = new Date(parseInt(this.data.exp));
    return this;
  }
  isExpired() {
    return (this.token) ? (this.data.exp.getTime() * 1000) < (new Date()).getTime() : true;
  }
}

class AtomCopilotAuth { // parent class of Auth
  constructor() {
    return this;
  }
  saveGithubAccessToken(token, settingsFile) {
    return new Promise((res, rej) => {
      const data = require(settingsFile);
      data.token = token;
      fs.writeFile(path.join(__dirname, settingsFile), JSON.stringify(data), (err) => {
        if (err) return rej(err);
        res();
      });
    });
  }
  refreshCopilotToken(accessToken, settingsFile) {
    return new Promise((res, rej) => {
      this.getCopilotToken(accessToken).then((token) => {
        if (token.message) res(null);
        const data = require(settingsFile);
        data.copilotToken = token.token;
        fs.writeFile(path.join(__dirname, settingsFile), JSON.stringify(data), (err) => {
          if (err) return rej(err);
          res(new CopilotToken(token.token));
        });
      }).catch(rej);
    });
  }
}

class Auth extends AtomCopilotAuth {
  static GITHUB = {
    deviceCodeUrl: "https://github.com/login/device/code",
    userAuthPage: "https://github.com/login/device",
    accessTokenUrl: "https://github.com/login/oauth/access_token",
    copilotTokenUrl: "https://api.github.com/copilot_internal/v2/token",
    grantType: "urn:ietf:params:oauth:grant-type:device_code"
  }
  constructor() {
    super();
    this.authData = {
      client_id: "01ab8ac9400c4e429b23", // Iv1.548c179098f4e414
      scope: "read:user"
    }
    return this;
  }
  post(url, data, headers, method) {
    return fetch(url, {
        method: (method) ? "post": (typeof method != "string") ? "get" : method,
        body: (data) ? JSON.stringify(data): null,
        headers: (headers) ? headers : {'Content-Type': 'application/json'}
    });
  }

  parseAuthResponse(text) {
    text = text.split("&").map(el => el.split("="));
    let response = {};
    text.forEach((item) => {
      response[item[0]] = item[1];
    });
    return response;
  }
  startAuthFlow() {
    return new Promise((res, rej) => {
      this.post(Auth.GITHUB.deviceCodeUrl, this.authData, null, true).then((result) => {
        result.text().then(text => {
          res(this.parseAuthResponse(text))
        })
      }).catch((e) => {
        rej(e);
      })
    });
  }
  getAccessToken(authData) {
    return new Promise((res, rej) => {
      this.post(Auth.GITHUB.accessTokenUrl, { client_id: this.authData.client_id, device_code: authData.device_code, grant_type: Auth.GITHUB.grantType }, null, true).then((result) => {
        result.text().then(text => {
          res(this.parseAuthResponse(text));
        });
      }).catch((e) => {
        rej(e);
      })
    });
  }
  getCopilotToken(accessToken) {
    return new Promise((res, rej) => {
      this.post(Auth.GITHUB.copilotTokenUrl, null, { Authorization: "token " + accessToken, pragma: "no-cache", "cache-control": "no-cache" }).then(result => {
        result.json().then(json=>{
          res(json);
        }).catch(e => {
          rej(e);
        })
      }).catch((e) => {
        rej(e);
      });
    });
  }
  openDeviceCodePrompt() {
    shell.openExternal(Auth.GITHUB.userAuthPage);
  }
}

module.exports = { CopilotToken, Auth };
