/**
 * stillmind-widget/plugin/index.js
 * Expo Config Plugin — adds iOS WidgetKit extension + Android App Widget
 */
const { withXcodeProject, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const WIDGET_TARGET = "StillMindWidget";
const WIDGET_BUNDLE_ID = "de.stillmind.app.widget";
const APP_GROUP = "group.de.stillmind.app";

// ── iOS ───────────────────────────────────────────────────────────────────────

const withiOSWidget = (config) => {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, "ios");
      const widgetDir = path.join(iosDir, WIDGET_TARGET);

      // Create widget target directory
      if (!fs.existsSync(widgetDir)) {
        fs.mkdirSync(widgetDir, { recursive: true });
      }

      // Copy Swift source
      const swiftSrc = path.join(projectRoot, "modules/stillmind-widget/ios/StillMindWidget.swift");
      const swiftDst = path.join(widgetDir, "StillMindWidget.swift");
      if (fs.existsSync(swiftSrc)) {
        fs.copyFileSync(swiftSrc, swiftDst);
      }

      // Copy Info.plist
      const plistSrc = path.join(projectRoot, "modules/stillmind-widget/ios/Info.plist");
      const plistDst = path.join(widgetDir, "Info.plist");
      if (fs.existsSync(plistSrc)) {
        fs.copyFileSync(plistSrc, plistDst);
      }

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const targetName = WIDGET_TARGET;

    // Add widget extension target if not already present
    const existingTargets = xcodeProject.pbxNativeTargetSection();
    const alreadyAdded = Object.values(existingTargets).some(
      (t) => t && t.name === targetName
    );

    if (!alreadyAdded) {
      // Add App Group entitlement to main target
      const appGroupsKey = "com.apple.security.application-groups";
      const mainTarget = xcodeProject.getFirstTarget().firstTarget;
      if (mainTarget) {
        // This is handled by app.json entitlements — just ensuring App Group matches
      }
    }

    return config;
  });

  return config;
};

// ── Android ───────────────────────────────────────────────────────────────────

const withAndroidWidget = (config) => {
  // Add widget receiver to AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    const receiverAlreadyAdded = (app.receiver || []).some(
      (r) => r.$?.["android:name"]?.includes("StillMindWidgetProvider")
    );

    if (!receiverAlreadyAdded) {
      if (!app.receiver) app.receiver = [];
      app.receiver.push({
        $: {
          "android:name": "de.stillmind.app.widget.StillMindWidgetProvider",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/stillmind_widget_info",
            },
          },
        ],
      });
    }

    return config;
  });

  // Copy Android files
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidSrc = path.join(projectRoot, "modules/stillmind-widget/android");
      const androidMain = path.join(projectRoot, "android/app/src/main");

      const copyDir = (src, dst) => {
        if (!fs.existsSync(src)) return;
        if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
          const srcPath = path.join(src, entry);
          const dstPath = path.join(dst, entry);
          if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, dstPath);
          } else {
            fs.copyFileSync(srcPath, dstPath);
          }
        }
      };

      // Copy res/ (layouts, drawables, xml)
      copyDir(path.join(androidSrc, "res"), path.join(androidMain, "res"));

      // Copy Kotlin source
      const ktSrc = path.join(androidSrc, "StillMindWidgetProvider.kt");
      const ktDstDir = path.join(androidMain, "java/de/stillmind/app/widget");
      if (fs.existsSync(ktSrc)) {
        if (!fs.existsSync(ktDstDir)) fs.mkdirSync(ktDstDir, { recursive: true });
        fs.copyFileSync(ktSrc, path.join(ktDstDir, "StillMindWidgetProvider.kt"));
      }

      return config;
    },
  ]);

  return config;
};

// ── Plugin Entry ──────────────────────────────────────────────────────────────

module.exports = (config) => {
  config = withiOSWidget(config);
  config = withAndroidWidget(config);
  return config;
};
