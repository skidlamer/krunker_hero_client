const os = require('os');
const fs = require('fs');
const util = require('util');
const path = require('path');
const url = require('url');
const request = require('request');
const agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36';
const rimraf = require('rimraf');
const Store = require('electron-store');
const config = new Store();
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);

module.exports.DEBUG = process.argv.includes('--dev') || false;

module.exports.isAMDCPU = Boolean(os.cpus().filter(x => /amd/i.test(x.model)).length);
module.exports.isWindows = os.platform() == 'win32';
module.exports.windowResize = {
	social: 0.8,
	viewer: 0.6,
	editor: 0.8
};

module.exports.GAME_REGEX = /^(https?:\/\/)?(www\.)?(.+)(krunker\.io|127\.0\.0\.1:8080)(|\/|\/\?game=.+)$/;
module.exports.GAME_CODE_REGEX = /^([A-Z]+):(\w+)$/;
module.exports.EDITOR_REGEX = /^(https?:\/\/)?(www\.)?(.+)(krunker\.io|127\.0\.0\.1:8080)\/editor\.html$/;
module.exports.VIEWER_REGEX = /^(https?:\/\/)?(www\.)?(.+)(krunker\.io|127\.0\.0\.1:8080)\/viewer\.html(.*)$/;
module.exports.SOCIAL_REGEX = /^(https?:\/\/)?(www\.)?(.+)(krunker\.io|127\.0\.0\.1:8080)\/social\.html(.*)$/;
module.exports.SITE_REGEX = /^(https?:\/\/)?(www\.)?(.+\.|)(krunker\.io|127\.0\.0\.1:8080)(|\/|.+)$/;
module.exports.PING_REGION_CACHE_KEY = "pingRegion4";

module.exports.DISCORD_ID = '560173821533880322';

module.exports.NO_CACHE = {userAgent: agent, "extraHeaders" : "pragma: no-cache\n"};

String.prototype.isCode = function() {
	return module.exports.GAME_CODE_REGEX.test(this + '');
};

String.prototype.isGame = function() {
	return module.exports.GAME_REGEX.test(this + '');
};

String.prototype.isEditor = function() {
	return module.exports.EDITOR_REGEX.test(this + '');
};

String.prototype.isViewer = function() {
	return module.exports.VIEWER_REGEX.test(this + '');
};

String.prototype.isSocial = function() {
	return module.exports.SOCIAL_REGEX.test(this + '');
};

String.prototype.isKrunker = function() {
	return module.exports.SITE_REGEX.test(this + '');
};

module.exports.joinPath = function(foo, bar) {
	return path.join(foo, bar);
}

module.exports.hexToRGB = hex => hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i,
		(m, r, g, b) => '#' + r + r + g + g + b + b)
	.substring(1).match(/.{2}/g)
	.map(x => parseInt(x, 16));

	const electron = require('electron');
	
module.exports.downloadFile = function(source) {
	electron.dialog.showSaveDialog(null, { defaultPath: path.resolve(electron.app.getPath("desktop"), path.basename(source)) }, fileName => {
	if (fileName) {
		var file = fs.createWriteStream(fileName);
		request({
			method: 'GET',
			uri: source,
		})
		.pipe(file)
		.on('finish', () => {
			electron.dialog.showMessageBox(null, {
				type: 'question',
				buttons: ['Ok'],
				message: 'Download Successful'
			});
		})
		.on('error', (error) => {
			console.error(error);
		})
	}	
	});
}

module.exports.loadScript = async function() {
	var types = [{name: 'Scripts', extensions: ['js']}, {name: 'All Files', extensions: ['*']}],
	options = {filters:types, properties:['openFile','multiSelections']}; 
	await electron.dialog.showOpenDialog(options).then(files => {
		if (!files.canceled) {
			files.filePaths.forEach(file => {
				const stream = fs.createReadStream(file, {encoding: 'utf8'})
				.on('data', data => {
					electron.BrowserWindow.getFocusedWindow().webContents.executeJavaScript(data);
					stream.destroy();
				});
			})
		}
	})	
}
  
module.exports.loadScripts = function() {
	electron.dialog.showOpenDialog({
        properties: ['openDirectory']
    }, function (folder) {
        if (folder !== undefined) {
            fs.readdir(folder[0], (err, files) => {
				if (err) {
					electron.dialog.showErrorBox(err.message, "An error ocurred opening scripts directory")
					return;
				} else {			
					files.forEach(file => {		
						const path = concat(folder, '\\', file);
						const stream = fs.createReadStream(path, {encoding: 'utf8'})
						.on('data', data => {
							electron.BrowserWindow.getFocusedWindow().webContents.executeJavaScript(data);
							stream.destroy();
						});
					})
				}
			})
        }
	});
}

module.exports.resetSettings = function() {
	const response = electron.dialog.showMessageBox(null,{
		buttons: ["Yes", "No"],
		message: "Are you sure you want to reset all your client addons? This will also refresh the page?"
	});
	if (response === 0) {
		Object.keys(config.store).filter(x => x.includes("utilities_")).forEach(x => config.remove(x));
		electron.BrowserWindow.getFocusedWindow().webContents.reloadIgnoringCache()
	}
}

module.exports.clearCache = function() {
	electron.dialog.showMessageBox(null, {
		buttons: ["Yes", "No"],
		message: "Are you sure you want to clear your cache? This will also relaunch the page"
	}, option => {
		if (option == 0) {
			const CACHE_PATH = path.join(path.join(electron.app.getPath('appData'), electron.app.getName()), "Cache");
			rimraf(CACHE_PATH, () => {
				electron.dialog.showMessageBox(null, {
					message: 'Cache cleared'
				});
				electron.app.relaunch();
				electron.app.exit();
			})
		}         
	})
}