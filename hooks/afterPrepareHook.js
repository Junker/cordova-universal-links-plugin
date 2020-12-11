/**
Hook is executed at the end of the 'prepare' stage. Usually, when you call 'cordova build'.

It will inject required preferences in the platform-specific projects, based on <universal-links>
data you have specified in the projects config.xml file.
*/
const path = require('path');
const fs = require('fs');
const plist = require('plist');
var configParser = require('./lib/configXmlParser.js');
var androidManifestWriter = require('./lib/android/manifestWriter.js');
var androidWebHook = require('./lib/android/webSiteHook.js');
var ConfigXmlHelper = require('./lib/configXmlHelper.js');
var ANDROID = 'android';
var IOS = 'ios';
const IOS_PLIST_PATH = 'platforms/ios/*/Entitlements-$Release.plist';
const ASSOCIATED_DOMAINS = 'com.apple.developer.associated-domains';
const releases = ['Debug', 'Release'];

module.exports = function(ctx) {
  run(ctx);
};

/**
 * Execute hook.
 *
 * @param {Object} cordovaContext - cordova context object
 */
function run(cordovaContext) {
  var pluginPreferences = configParser.readPreferences(cordovaContext);
  var platformsList = cordovaContext.opts.platforms;

  // if no preferences are found - exit
  if (pluginPreferences == null) {
    return;
  }

  // if no host is defined - exit
  if (pluginPreferences.hosts == null || pluginPreferences.hosts.length == 0) {
    console.warn('No host is specified in the config.xml. Universal Links plugin is not going to work.');
    return;
  }

  platformsList.forEach(function(platform) {
    switch (platform) {
      case ANDROID:
        {
          activateUniversalLinksInAndroid(cordovaContext, pluginPreferences);
          break;
        }
      case IOS:
        {
          activateUniversalLinksInIos(cordovaContext, pluginPreferences);
          break;
        }
    }
  });
}

/**
 * Activate Deep Links for Android application.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from the config.xml file. Basically, content from <universal-links> tag.
 */
function activateUniversalLinksInAndroid(cordovaContext, pluginPreferences) {
  // inject preferenes into AndroidManifest.xml
  androidManifestWriter.writePreferences(cordovaContext, pluginPreferences);

  // generate html file with the <link> tags that you should inject on the website.
  androidWebHook.generate(cordovaContext, pluginPreferences);
}

/**
 * Name of the project from config.xml
 *
 * @return {String} project name
 */
function getProjectName(context) {
  var configXmlHelper = new ConfigXmlHelper(context);
  return configXmlHelper.getProjectName();
}

/**
 * Activate Universal Links for iOS application.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from the config.xml file. Basically, content from <universal-links> tag.
 */
function activateUniversalLinksInIos(context, pluginPreferences) {
  const pathToUse = IOS_PLIST_PATH.replace(/\*/g, getProjectName(context));

  releases.forEach((release) => {
    const iosInfoPath = path.join(context.opts.projectRoot, pathToUse.replace('$Release', release));

    let iosInfo = fs.readFileSync(iosInfoPath, 'utf8');
  
    iosInfo = plist.parse(iosInfo)
  
    if (!iosInfo[ASSOCIATED_DOMAINS]) {
      iosInfo[ASSOCIATED_DOMAINS] = [];
    }
  
    pluginPreferences.hosts.forEach((host) => {
      const url = `applinks:${host.name}`;
  
      if (!iosInfo[ASSOCIATED_DOMAINS].find((hostUrl) => hostUrl === url)) {
        iosInfo['com.apple.developer.associated-domains'].push(url);
      }
    });
  
    const xml = plist.build(iosInfo);
  
    fs.writeFileSync(iosInfoPath, xml);
  });
}
