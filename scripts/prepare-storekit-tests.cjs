// CI-only test target. Never included in distribution archives.
const fs=require('node:fs'),xcode=require('xcode');
const path='ios/App/App.xcodeproj/project.pbxproj',p=xcode.project(path);p.parseSync();
const app=p.getFirstTarget(),deps=[...app.firstTarget.dependencies];
p.hash.project.objects.PBXContainerItemProxy ||= {};
p.hash.project.objects.PBXTargetDependency ||= {};
const t=p.addTarget('PurchaseTests','unit_test_bundle','PurchaseTests','jp.amimononote.tests');
app.firstTarget.dependencies=deps;p.addTargetDependency(t.uuid,[app.uuid]);
const configs=p.pbxXCConfigurationList()[t.pbxNativeTarget.buildConfigurationList].buildConfigurations;
for(const c of configs){const b=p.pbxXCBuildConfigurationSection()[c.value].buildSettings;
 delete b.INFOPLIST_FILE;Object.assign(b,{GENERATE_INFOPLIST_FILE:'YES',SWIFT_VERSION:'5.0',IPHONEOS_DEPLOYMENT_TARGET:'17.0',TARGETED_DEVICE_FAMILY:'"1,2"',TEST_HOST:'"$(BUILT_PRODUCTS_DIR)/App.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/App"',BUNDLE_LOADER:'"$(TEST_HOST)"',CODE_SIGNING_ALLOWED:'NO'});
}
fs.mkdirSync('ios/App/PurchaseTests',{recursive:true});
for(const file of ['PurchaseTests.swift','Purchases.storekit'])fs.copyFileSync('tests/storekit/'+file,'ios/App/PurchaseTests/'+file);
p.addBuildPhase(['PurchaseTests/PurchaseTests.swift'],'PBXSourcesBuildPhase','Sources',t.uuid);
p.addBuildPhase(['PurchaseTests/Purchases.storekit'],'PBXResourcesBuildPhase','Resources',t.uuid);
p.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',t.uuid);
fs.writeFileSync(path,p.writeSync());
fs.mkdirSync('ios/App/App.xcodeproj/xcshareddata/xcschemes',{recursive:true});
const ref=(id,name)=>`<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id}" BuildableName="${name==='App'?'App.app':'PurchaseTests.xctest'}" BlueprintName="${name}" ReferencedContainer="container:App.xcodeproj"/>`;
fs.writeFileSync('ios/App/App.xcodeproj/xcshareddata/xcschemes/PurchaseTests.xcscheme',`<?xml version="1.0"?><Scheme LastUpgradeVersion="1600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${ref(app.uuid,'App')}</BuildActionEntry><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${ref(t.uuid,'PurchaseTests')}</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">${ref(t.uuid,'PurchaseTests')}</TestableReference></Testables><StoreKitConfigurationFileReference identifier="../../PurchaseTests/Purchases.storekit"/></TestAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0"><BuildableProductRunnable runnableDebuggingMode="0">${ref(app.uuid,'App')}</BuildableProductRunnable><StoreKitConfigurationFileReference identifier="../../PurchaseTests/Purchases.storekit"/></LaunchAction></Scheme>`);
