'use babel';
const EventEmitter = require("events");

export default class LibreCopilotAtomView {

  constructor() {
    this.emitter = new EventEmitter();

    this.reset();
  }
  reset() {
    this.element = document.createElement('div');
    this.element.classList.add('libre-copilot-atom');

    this.center = document.createElement("center");
    this.element.appendChild(this.center);

    this.code = document.createElement("h1");
    this.code.textContent = "Loading Device Code...";
    this.code.classList.add("atom-copilot-code");
    this.center.appendChild(this.code);

    const message = document.createElement('div');
    message.textContent = 'Please enter the code above into GitHub and then click "Authorize".';
    message.classList.add('message');
    this.center.appendChild(message);
    const br = document.createElement("br");
    this.center.appendChild(br);

    this.btn = document.createElement("button");
    this.btn.classList.add("btn");
    this.btn.classList.add("outline-btn");
    this.btn.textContent = "Authorize";
    this.btn.disabled = true;
    this.btn.onclick = () => {
      this.emitter.emit("submit");
    }
    this.center.appendChild(this.btn);

    const close = document.createElement("button");
    close.classList.add("btn");
    close.classList.add("outline-btn");
    close.textContent = "Close";
    close.onclick = () => {
      this.emitter.emit("close");
    }
    this.center.appendChild(close);
  }
  on(event, cb) {
    return this.emitter.on(event, cb);
  }
  once(event, cb) {
    return this.emitter.once(event, cb);
  }
  updateDeviceCode(code) {
    this.code.textContent = code;
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

}
