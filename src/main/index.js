'use strict'
// includes
import { app, BrowserWindow, session, screen, Menu, dialog, ipcMain } from 'electron';
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import * as got from 'got'
import * as request from 'request'
import * as store from 'electron-store'
import * as shortcut from 'electron-localshortcut'
import { format as formatUrl } from 'url'

// global references
const config = new store();
const gameScripts = new Map();
let mainWindow = null, swapFolder = '';
const isDev = process.env.NODE_ENV !== 'production'
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36';
const noCache = { userAgent: userAgent, "extraHeaders": "pragma: no-cache\n" };
const cStruct = (...keys) => ((...a) => keys.reduce((x, y, z) => { x[y] = a[z]; return x }, {}))
const script_t = cStruct('file', 'pattern', 'url', 'redirect');

// command line switches
function initCmdSwitches() {
  if (config.get('unlimitedFrames', true)) {
      if (Boolean(os.cpus().filter(x => /amd/i.test(x.model)).length)) {
          app.commandLine.appendSwitch('disable-zero-copy');
          app.commandLine.appendSwitch('ui-disable-partial-swap');
      }
      app.commandLine.appendSwitch('disable-gpu-vsync');
      //app.commandLine.appendSwitch('disable-frame-rate-limit');
  }
  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch('ignore-gpu-blacklist', true);
  app.commandLine.appendSwitch('enable-webgl2-compute-context');
  if (config.get('d3d9Mode', false)) {
      app.commandLine.appendSwitch('use-angle', 'd3d9');
      app.commandLine.appendSwitch('use-cmd-decoder=passthrough');
      app.commandLine.appendSwitch('renderer-process-limit', 100);
      app.commandLine.appendSwitch('max-active-webgl-contexts', 100);
  }
}; initCmdSwitches(); // excecuted ASAP (before app ready)

// app menu layout
//https://zeke.github.io/electron.atom.io/docs/api/menu-item/
function initAppMenu() {
    console.log('process.platform', process.platform)
    if (process.platform == 'win32') {
        const template = [{
                label: 'File',
                submenu: [ // TYPES : normal, separator, submenu, checkbox or radio.
                    {
                        label: 'Save game.js',
                        click: _ => downloadFile(gameScripts.get('game').url)
                    },
                    {
                        label: "Save zip.js",
                        click: _ => downloadFile(gameScripts.get('zip').url)
                    },
                    {
                        label: "Save zip-ext.js",
                        click: _ => downloadFile(gameScripts.get('zip-ext').url)
                    },
                    {
                        type: "separator"
                    },
                    {
                        label: "Quit",
                        accelerator: "Alt+F4",
                        click: _ => app.quit()
                    },
                    {
                        type: "separator"
                    }
                ]
            },

            {
                label: 'Settings',
                submenu: [{
                        type: 'checkbox',
                        checked: config.get('unlimitedFrames', false),
                        label: 'unlimitedFrames',
                        click: _ => {
                            dialog.showMessageBox(mainWindow, {
                                buttons: ["Yes", "No"],
                                message: "Changing this will restart client continue?"
                            }, option => {
                                if (option == 0) {
                                    config.set("unlimitedFrames", !config.get('unlimitedFrames', false));
                                    app.relaunch();
                                    app.quit();
                                }         
                            })
                        }
                    },
                    {
                        type: 'checkbox',
                        checked: false,
                        label: 'Place Holder',
                        click: _ => {
                            console.log('')
                            console.log('Place Holder is clicked')
                        }
                    },
                    {
                        type: 'checkbox',
                        checked: false,
                        label: 'Place Holder 2',
                        click: _ => {
                            console.log('')
                            console.log('Place Holder 2 is clicked')
                        }
                    },
                ]
            },

            {
                label: 'View',
                submenu: [{
                        role: 'reload'
                    },
                    {
                        role: 'toggledevtools'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        role: 'resetzoom'
                    },
                    {
                        role: 'zoomin'
                    },
                    {
                        role: 'zoomout'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        role: 'togglefullscreen'
                    }
                ]
            },

            {
                role: 'window',
                submenu: [{
                        role: 'minimize'
                    },
                    {
                        role: 'close'
                    }
                ]
            },

            {
                role: 'help',
                submenu: [{
                    label: 'Learn More'
                }]
            }
        ]
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
}

// create main BrowserWindow
const createMainWindow = () => {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  mainWindow = new BrowserWindow({
      width: area.width,
      height: area.height,
      frame: true,
      autoHideMenuBar: true, //menu bar
      toolbar: false, //title bar
      show: false,
      webPreferences: {
          nodeIntegration: true,
          webSecurity: false
      }
  })

  mainWindow.loadURL('https://krunker.io', noCache);

  mainWindow.once('ready-to-show', () => {
      if (isDev) mainWindow.webContents.openDevTools({
          mode: 'undocked'
      });
      if (config.get('fullscreen', false) && !mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
      else mainWindow.maximize();
      mainWindow.show();
  });

  mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.focus()
      setImmediate(() => {
          mainWindow.focus()
      })
  })

  mainWindow.once('closed', () => {
      mainWindow = null;
  });
}

const initNavListener = () => {
    ipcMain.on('nav-response', (event, ret) => {
       if (!ret) return;
        const url = "https://krunker.io/" + ret;
        mainWindow.loadURL(url, noCache);
     });
 }; initNavListener();

function initShortcuts() {
  const KEY_BINDS = {
      escape: {
          key: 'Esc',
          press: _ => mainWindow.webContents.send('Esc')
          
      },
      quit: {
          key: 'Alt+F4',
          press: _ => app.quit()
      },
      refresh: {
          key: 'F5',
          press: _ => mainWindow.webContents.reloadIgnoringCache()
      },
      fullscreen: {
          key: 'F11',
          press: _ => {
              let full = !mainWindow.isFullScreen();
              mainWindow.setFullScreen(full);
              config.set("fullscreen", full);
          }
      },
      menuBar: {
          key: 'Alt',
          press: _ => {
              let value = !mainWindow.isMenuBarVisible();
              mainWindow.webContents.send('nav-request')
              mainWindow.setMenuBarVisibility(value);
          }
      },
      menu: {
          key: 'Ctrl+Tab',
          press: _ => mainWindow.webContents.send('nav-request')
      },
      clearConfig: {
          key: 'Ctrl+F1',
          press: _ => {
              config.store = {};
              app.relaunch();
              app.quit();
          }
      },
      openConfig: {
          key: 'Shift+F1',
          press: _ => config.openInEditor(),
      },
      openDevTools: {
          key: 'F12',
          press: _ => mainWindow.webContents.openDevTools({
              mode: 'undocked'
          }),
      },
  }
  Object.keys(KEY_BINDS).forEach(k => {
      shortcut.register(mainWindow, KEY_BINDS[k].key, () => KEY_BINDS[k].press());
  });
}

app.once('before-quit', () => {
    shortcut.unregisterAll();
    mainWindow.close();
});

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
      app.quit()
  }
})

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
      createMainWindow();
  }
})

// wait fo electron to become ready
app.on('ready', () => {
  (async () => { // async initialization
    try {
        //Swap Folder
        swapFolder = path.join(app.getPath('documents'), '/KrunkerResourceSwapper');
        try {
            fs.mkdir(swapFolder, {
                recursive: true
            }, e => {});
        } catch (e) {};
        let swap = {
            filter: {
                urls: []
            },
            files: {}
        };
        
        const response = await got('https://krunker.io/');
        const build = response.body.match(/(?<=build=)[^"]+/)[0];
        gameScripts.set('game', script_t('game.js', '*://krunker.io/js/game*', `https://krunker.io/js/game.${build}.js`, ''));
        //gameScripts.set('zip', script_t('zip.js', '*://krunker.io/libs/zip.*', 'https://krunker.io/libs/zip.js', ''));
        //gameScripts.set('zip-ext', script_t('zip-ext.js', '*://krunker.io/libs/zip-ext*', 'https://krunker.io/libs/zip-ext.js', ''));
        for (const [name, obj] of gameScripts) {
        const fullPath = path.join(swapFolder, obj.file);
        try {
            if (fs.existsSync(fullPath)) {

                swap.filter.urls.push(obj.pattern);
                swap.files[obj.pattern.replace(/\*/g, '')] = fullPath;

                //redirectScript(obj.pattern, fullPath);

               // swap.filter.url  *://krunker.io/css/fonts/font2.ttf*
               // swap.files[ ://krunker.io/css/fonts/font2.ttf ]
               // swap.file file:///C:\Users\Administrator\Documents\KrunkerResourceSwapper\css\fonts\font2.ttf
             




                //swap.files[obj.pattern.replace(/\*/g, '')] = fullPath;

                //let krunk = '*://krunker.io' + fullPath.replace(swapFolder, '').replace(/\\/g, '/') + '*';
              //          swap.filter.urls.push(krunk);
              //          swap.files[krunk.replace(/\*/g, '')] = url.format({
             //               pathname: filePath,
             //               protocol: 'file:',
              //              slashes: true
             //           });
                
            }
        } catch(err) {
            console.error(err)
        } 
    }               
        
        const allFilesSync = (dir, fileList = []) => {
            fs.readdirSync(dir).forEach(file => {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                    allFilesSync(filePath);
                } else {
                    if (!file.includes('.js')) {
                        let krunk = '*://krunker.io' + filePath.replace(swapFolder, '').replace(/\\/g, '/') + '*';
                        swap.filter.urls.push(krunk); //console.log('swap.filter.url ', krunk);
                        krunk = krunk.replace(/\*/g, '');
                        //console.log('swap.files[',krunk,']');
                        swap.files[krunk] = url.format({
                            pathname: filePath,
                            protocol: 'file:',
                            slashes: true
                        });
                       // console.log('swap.file' , swap.files[krunk])
                    }
                }
            });
        };
        allFilesSync(swapFolder);
        if (swap.filter.urls.length) {
            session.defaultSession.webRequest.onBeforeRequest(swap.filter, (details, callback) => {
                let redirect = swap.files[details.url.replace(/https|http|(\?.*)|(#.*)/gi, '')] || details.url;
                if (redirect.includes('.js')) {
                    redirect = redirect.substring(0, redirect.lastIndexOf('.js') + 3) || redirect;
                    redirect.replace(build, '') || redirect;
                    console.warn(redirect);
                }
                
                callback({
                    cancel: false,
                    redirectURL: redirect
                });

                //const url = details.url.substring(0, details.url.lastIndexOf('.js') + 3) || details.url;
                console.log('Redirecting ', details.url, 'to', redirectURL: swap.files[details.url.replace(/https|http|(\?.*)|(#.*)/gi, '')] || details.url);


                //console.log('onBeforeRequest details', details);
            });
        }
 //       const response = await got('https://krunker.io/');
 //       const build = response.body.match(/(?<=build=)[^"]+/)[0];
 //       gameScripts.set('game', script_t('game.js', 'https://krunker.io/js/game*', `https://krunker.io/js/game.${build}.js`, ''));
        // Disabled until Issue bellow is resolved
        //gameScripts.set('zip', script_t('zip.js', 'https://krunker.io/libs/zip.*', 'https://krunker.io/libs/zip.js', ''));
        //gameScripts.set('zip-ext', script_t('zip-ext.js', 'https://krunker.io/libs/zip-ext*', 'https://krunker.io/libs/zip-ext.js', ''));

 //       for (const [name, obj] of gameScripts) {
 //           const fullPath = path.join(swapFolder, obj.file);
            //Synchronously
 //           try {
  //                if (fs.existsSync(fullPath)) {
  //                redirectScript(obj.pattern, fullPath); // Issue here only the last of the container (if in swap dir) is redirected NFI why
  //                }
  //          } catch(err) {
  //                console.error(err)
  //          }
            //Asynchronously
            /*
            fs.access(fullPath, (err) => {
                if (err == null) {  //file exists
                    redirectScript(obj.pattern, fullPath);
                }
            });
            */
 //       }
        //Spoof user agent to regualar chrome
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            details.requestHeaders['User-Agent'] = noCache;
            callback({
                cancel: false,
                requestHeaders: details.requestHeaders
            });
        });
        Promise.resolve(true);
    } catch (error) {
        console.log(error.response.body);
    }
  })();
  initAppMenu();
  createMainWindow();
  initShortcuts();
})

/*##############################################################################*/
// Various Helper Functions. - maybe put these in their own file later (skid)

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function webRequest(configuration) {
  return new Promise(function(resolve, reject) {
      // Save variable to know progress
      var received_bytes = 0;
      var total_bytes = 0;

      var req = request({
          method: 'GET',
          uri: configuration.remoteFile
      });

      var out = fs.createWriteStream(configuration.localFile);
      req.pipe(out);

      req.on('response', function(data) {
          // Change the total bytes value to get progress later.
          total_bytes = parseInt(data.headers['content-length']);
      });

      // Get progress if callback exists
      if (configuration.hasOwnProperty("onProgress")) {
          req.on('data', function(chunk) {
              // Update the received bytes
              received_bytes += chunk.length;

              configuration.onProgress(received_bytes, total_bytes);
          });
      } else {
          req.on('data', function(chunk) {
              // Update the received bytes
              received_bytes += chunk.length;
          });
      }

      req.on('end', function() {
          return resolve();
      });
  });
}

function downloadFile(source) {
    const filename = source.substring(source.lastIndexOf('/') + 1);
    const options = {
        defaultPath: swapFolder + `/${filename}`
    }
    dialog.showSaveDialog(mainWindow, options, choice => {
        if (choice == 1) { // cancel, save
            webRequest({
                remoteFile: source,
                localFile: dir,
                onProgress: function(received, total) {
                    let percent = (received * 100) / total;
                    console.log(percent + "% | " + received + " bytes out of " + total + " bytes.");
                }
            }).then(function() {
                dialog.showMessageBox(null, {
                    type: 'question',
                    buttons: ['Ok'],
                    message: 'Download Successful'
                });
            });
        }
    })
}
/*
function redirectScript(pattern, redirect) {
  session.defaultSession.webRequest.onBeforeRequest({
      urls: [pattern], 
  }, (details, callback) => {
      callback({
          cancel: false,
          redirectURL: redirect
      });
      console.log('onBeforeRequest details', details);
      const url = details.url.substring(0, details.url.lastIndexOf('.js') + 3) || details.url;
      console.log('Redirecting ', url, 'to', redirect);
  })
  session.defaultSession.webRequest.onErrorOccurred((details) => {
    console.log("error occurred on request");
    console.log(details);
    })
}
*/
function loadScripts(dir) {
    fs.readdir(dir, (err, files) => {
        if (err) {
            console.error("An error ocurred opening scripts directory" + err.message);
            return;
        } else {
            files.forEach(file => {
                if (file !== 'preload') {
                    console.log(file);
                    mainWindow.webContents.executeJavaScript(fs.readFileSync(dir + file, 'utf8'))
                }
            })
        }
    })
}

