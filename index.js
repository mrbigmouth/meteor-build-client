'use strict';
// MODULES
const fs = require('fs');
const path = require('path');
const _ = require('underscore');

// execute shell scripts
function execute(command, args, cwd, callback) {
  const spawn = require('child_process').spawn(command, args, {cwd});
  const argString = args.join(' ');
  console.log(`execute command "${command} ${argString}" in ${cwd}...`);
  spawn.stdout.on('data', function(data) {
    console.log(data);
  });
  spawn.stderr.on('data', function(warn) {
    console.log(warn.toString('utf8'));
  });
  spawn.stderr.on('error', function(error) {
    callback(error);
  });
  spawn.on('close', function (code) {
    callback();
  });
};

//delete folder recursive
function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path);
    files.forEach(function(file, index) {
      const curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      }
      else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

//use meteor command to build
function build(state, callback) {
  console.log('Bundling Meteor app...');
  // remove the bundle folder
  deleteFolderRecursive(state.buildPath);
  const args = ['build', ...state.args, '--directory', state.buildPath];
  execute(
    'meteor',
    args,
    state.sourcePath,
    function(error, respond) {
      if (error) {
        callback(error, state);
      }
      else {
        console.log(respond);
        callback(null, state);
      }
    }
  );
};

function move(state, callback) {
  console.log('move client file to build path...');
  try {
    const files = state.files;
    const buildPath = state.buildPath;
    const clientPath = path.join(buildPath, '/bundle/programs/web.browser');
    fs.readdirSync(clientPath).forEach(function(file) {
      const source = path.join(clientPath, file);
      const to = path.join(buildPath, file);
      console.log(`move ${source} to ${to}`);
      fs.renameSync(source, to);
    });
    //save star json
    state.starJson = require(path.join(buildPath, '/bundle/star.json'));
    state.programJson = require(path.join(buildPath, 'program.json'));
    callback(null, state);
  }
  catch(e) {
    callback(e, state);
  }
};

function createIndexHtml(state, callback) {
  console.log('create index html...');
  const buildPath = state.buildPath;
  const starJson = state.starJson;
  const programJson = state.programJson;
  const settingsJson = state.settings || {};

  console.log('reading index template...');
  let indexContent = state.template || fs.readFileSync(path.resolve(__dirname, 'index.html'), {encoding: 'utf-8'});
  console.log('reading <head> content...');
  let headContent;
  try {
    headContent = fs.readFileSync(path.join(buildPath, 'head.html'), {encoding: 'utf8'});
  }
  catch(e) {
    headContent = '';
    console.log('No <head> found in Meteor app...');
  }
  console.log('put <head> content into index html...');
  indexContent = indexContent.replace(/{{ *> *head *}}/, headContent);

  // ADD CSS
  const styleFiles = programJson.manifest.filter(o => o.type === 'css');
  console.log('put css links into index html...');
  const styleLinkList = styleFiles.map((o) => {
    return `<link rel="stylesheet" type="text/css" class="__meteor-css__" href="${o.url}">`;
  });
  indexContent = indexContent.replace(/{{ *> *css *}}/, styleLinkList.join('\n'));

  // ADD the SCRIPT files
  console.log('put script links into index html...');
  const scriptFiles = programJson.manifest.filter(o => o.type === 'js');
  const scriptLinkList = scriptFiles.map((o) => {
    return `<script type="text/javascript" src="${o.url}"></script>`;
  });
  // add the meteor runtime config
  const settings = {
    'meteorRelease': starJson.meteorRelease,
    'ROOT_URL_PATH_PREFIX': ''
  };
  // on url = "default", we dont set the ROOT_URL, so Meteor chooses the app serving url for its DDP connection
  if (state.root_url) {
    settings.ROOT_URL = state.root_url;
  }
  if (settingsJson.public) {
    settings.PUBLIC_SETTINGS = settingsJson.public;
  }
  let settingExtraContent = '';
  //if set ddp url, change DDP_DEFAULT_CONNECTION_URL in settings
  if (state.ddp_url) {
    settings.DDP_DEFAULT_CONNECTION_URL = state.ddp_url;
  }
  //else if have ddp packages, automatic disconnect ddp
  else {
    settingExtraContent = '<script type="text/javascript">if (Meteor.disconnect) { Meteor.disconnect(); }</script>';
  }
  const settingContent = '<script type="text/javascript">__meteor_runtime_config__ = JSON.parse(decodeURIComponent("'+encodeURIComponent(JSON.stringify(settings))+'"));</script>';
  indexContent = indexContent.replace(/{{ *> *scripts *}}/, settingContent + scriptLinkList.join('\n') + settingExtraContent);

  // write the index.html
  console.log('create index.html...');
  fs.writeFile(path.join(buildPath, 'index.html'), indexContent, function(error) {
    if (error) {
      callback(error, state);
    }
    else {
      callback(null, state);
    }
  });
}

function cleanUp(state, callback) {
  console.log('clean up temp files...');
  const buildPath = state.buildPath;
  try {
    deleteFolderRecursive(path.join(buildPath, 'bundle'));
    fs.unlinkSync(path.join(buildPath, 'program.json'));
    fs.unlinkSync(path.join(buildPath, 'head.html'));
    callback(null, state);
  }
  catch (error){
    callback(error);
  }
}

const async = require('async');
const startBuild = _.debounce(function startBuild(options) {
  async.waterfall([
    function initialize(callback) {
      callback(null, options);
    },
    build,
    move,
    createIndexHtml,
    cleanUp
  ], function(error) {
    if (error) {
      console.log(error);
      process.exit(1);
    }
    else {
      console.log('build meteor client done!');
    }
  });
}, 1000);

module.exports = function startWatch(options) {
  fs.watch(options.sourcePath, {
    persistent: false,
    recursive: true
  })
  .on('change', function() {
    console.log('detect source change...');
    startBuild(options);
  })
  .on('error', function(error) {
    console.log(error);
    process.exit(1);
  });
  console.log('start first time build...');
  startBuild(options);
}