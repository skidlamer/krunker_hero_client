const { remote, ipcRenderer } = require('electron');
//const Store = require('electron-store');
//const config = new Store();
//const consts = require('./constants.js');
//const url = require('url');
//const rimraf = require('rimraf');
//const CACHE_PATH = consts.joinPath(consts.joinPath(remote.app.getPath('appData'), remote.app.getName()), "Cache");

class Utilities {
	constructor() {
		this.settings = null;
		this.onLoad();
	}

	createWatermark() {
		const el = document.createElement("div");
		el.id = "watermark";
		el.style.position = "absolute";
		el.style.color = "rgba(0,0,0, 0.5)";
		el.style.bottom = "0";
		el.style.left = "20px";
		el.style.fontSize = "6pt";
		el.innerHTML = "Krunker.io Client v" + remote.app.getVersion();
		gameUI.appendChild(el);
	}

	keyDown(event) {
		if (document.activeElement.tagName == "INPUT") return;
		if (event.ctrlKey) {
			document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
			document.exitPointerLock();
		}
	}

	fixMenuSettings() {
		[...document.querySelectorAll(".menuItemIcon")].forEach(el => el.style.height = "60px");
	}

	onLoad() {
		this.fixMenuSettings();
		this.createWatermark();
		window.addEventListener("keydown", event => this.keyDown(event));
	}
}

module.exports = Utilities;
