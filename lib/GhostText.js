class Ghost {
  constructor(data) {
    this.element = data.element;
    this.newLineRange = data.newLineRange;
    this.column = data.column;
    this.position = data.position;
    this.text = data.text;

    return this;
  }

  equals(ghost) {
    return (this.newLineRange === ghost.newLineRange
      && this.column === ghost.column
      && this.equalsPosition(ghost.position)
      && this.text === ghost.text);
  }
  equalsPosition(pos) {
    return (this.position.buffer.column === pos.buffer.column
      && this.position.buffer.row === pos.buffer.row
      && this.position.screen.row === pos.screen.row
      && this.position.screen.column === pos.screen.column);
  }
}

class GhostText {
  constructor() {
    this.activeGhosts = [];

    return this;
  }

  asHTML(element) {
    let temp = document.createElement("span");
    temp.appendChild(element);
    return temp.innerHTML;
  }
  removeGhosts() {
    this.activeGhosts.forEach((ghost, i) => {
      var parent = ghost.element.parentNode;
      var index = Array.prototype.indexOf.call(parent.childNodes, ghost.element);
      if (parent.childNodes.length != index + 1) {
        let last = parent.childNodes[index + 1];
        let first = parent.childNodes[index - 1];
        if (first) first.appendData(last.textContent);
        if (last) last.remove();
      }
      if (ghost.newLineRange[0] <= ghost.newLineRange[1]) atom.workspace.getActiveTextEditor().getBuffer().deleteRows(ghost.newLineRange[0], ghost.newLineRange[1]);
      ghost.element.remove();
      this.activeGhosts.splice(i, 1);
    });
  }

  insertAtCursor(text) {
    var currLine = atom.workspace.getActiveTextEditor().getCursorScreenPosition();
    var pos = atom.workspace.getActiveTextEditor().getCursorBufferPosition();
    return this.insertAt(text, currLine, pos);
  }
  registerGhost(elem, currLine, pos, l, originalLine, text) {
    let ghost = new Ghost({ element: elem, position: { buffer: pos, screen: originalLine }, column: currLine.column, newLineRange: [pos.row + 1, pos.row + l - 1], text: text });
    this.activeGhosts.push(ghost);

    atom.workspace.getActiveTextEditor().onDidRemoveCursor(() => {
      this.removeGhosts();
    });
    atom.workspace.getActiveTextEditor().onDidAddCursor(() => {
      this.removeGhosts();
    });
    atom.workspace.getActiveTextEditor().getCursors()[0].onDidChangePosition((e) => {
      if (e.textChanged || e.newScreenPosition.row != currLine.row || e.newScreenPosition.column > currLine.column) {
        this.removeGhosts();
      }
    });
    return ghost;
  }
  synthesize(ghost) {
    for (let i = 0; i < this.activeGhosts.length; i++) {
      if (!ghost.equals(this.activeGhosts[i])) continue
      this.removeGhosts();
      return atom.workspace.getActiveTextEditor().getBuffer().insert(ghost.position.buffer, ghost.text);;
    }
    return false;
  }
  insertAt(text, currLine, pos) {
    var originalText = text.repeat(1);
    var originalLine = { row: currLine.row, column: currLine.column };
    var l = text.split("\n").length;
    var newLines = "";
    for (let i = 0; i < l - 1; i++) {
      newLines = newLines + "\n";
    }
    var line = document.querySelector("div.line[data-screen-row='" + (currLine.row) + "']");
    if (line.children[0].children.length == 0) {
      line = document.querySelector("div.line[data-screen-row='" + (currLine.row - 1) + "']");
      text = "\n" + text;
      let lineText = atom.workspace.getActiveTextEditor().lineTextForScreenRow(currLine.row - 1);
      currLine.column = lineText.length;

    }
    atom.workspace.getActiveTextEditor().setTextInBufferRange([[pos.row + 1, 0],[pos.row + 1, 0]], newLines);//(line.children[0].children.length == 0) ? "" + newLines : newLines);

    const elem = document.createElement("span");
    elem.className = "syntax--comment syntax--block";
    elem.textContent = text;

    var elements = line.children[0].children[0].childNodes;
    var cursorElement = null;
    var elemPos = null;
    for (var i = 0, cLength = 0; i < elements.length; i++) {
      let diff = currLine.column - cLength;
      let length = (typeof elements[i] == "object") ? elements[i].textContent.length : elements[i].length;
      cLength += length;
      if (diff <= length) {
        elemPos = diff;
        cursorElement = elements[i];
        break;
      }
    }

    if (!cursorElement || (!elemPos && elemPos != 0)) return false;

    var c = (cursorElement instanceof HTMLElement) ? cursorElement.childNodes[0] : cursorElement;

    c.splitText(elemPos);
    var parent = c.parentNode;
    var index = Array.prototype.indexOf.call(parent.childNodes, c);
    if (index == parent.childNodes.length - 1) {
      parent.appendChild(elem);
    } else {
      parent.insertBefore(elem, parent.childNodes[index + 1])
    }
    return this.registerGhost(elem, currLine, pos, l, originalLine, originalText);

    //if (cursorElement.childNodes.length == 0) cursorElement.textContent = " ";
    /*if (cursorElement instanceof HTMLElement) {
      var t = cursorElement.innerHTML;
      var first = t.slice(0, elemPos);
      if (t.length == elemPos) {
        cursorElement.innerHTML = first + this.asHTML(elem);
      } else {
        var last = t.slice(elemPos, t.length);
        cursorElement.innerHTML = first + this.asHTML(elem) + last;
      }
    } else {
      cursorElement.splitText(elemPos);
      var parent = cursorElement.parentNode;
      var index = Array.prototype.indexOf.call(parent.childNodes, cursorElement);
      if (index == parent.childNodes.length - 1) {
        parent.appendChild(elem);
      } else {
        parent.insertBefore(elem, parent.childNodes[index + 1])
      }
    }*/
    /*var pos = atom.workspace.getActiveTextEditor().getCursorScreenPosition();
    var line = document.querySelector("div.line[data-screen-row='" + pos.row + "']");
    var content = line.children[0];
    var chars = Math.round(parseInt(content.offsetWidth) / 7.7);*/
  }
}

module.exports = GhostText;
