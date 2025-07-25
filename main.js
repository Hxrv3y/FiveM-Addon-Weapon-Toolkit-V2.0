const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  mainWindow.setMenu(null);

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('perform-action', async (event, ...args) => {
  console.log('IPC message received in main process:', args);
  return { success: true, message: 'Action performed in main process' };
});

async function scanWeaponTemplatesLogic(basePath) {
  const templatesDir = path.join(basePath, 'templates', 'weapons');
  try {
    const weaponFolders = await fs.readdir(templatesDir, { withFileTypes: true });
    const templates = weaponFolders
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        path: path.join(templatesDir, dirent.name)
      }));
    return { success: true, templates };
  } catch (error) {
    console.error('Error scanning templates:', error);
    return { success: false, error: error.message, templates: [] };
  }
}

ipcMain.handle('scan-templates', async () => {
  return module.exports.scanWeaponTemplatesLogic(__dirname);
});

ipcMain.handle('get-template-details', async (event, templatePath) => {
  const templateNameKey = path.basename(templatePath);
  const weaponMetaPath = path.join(templatePath, 'weapons.meta');
  const weaponAnimsPath = path.join(templatePath, 'weaponanimations.meta');
  const displayNamesPath = path.join(__dirname, 'display_names.json');

  const { XMLParser } = require('fast-xml-parser');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    transformTagName: (tagName) => tagName.toUpperCase(),
    transformAttributeName: (attributeName) => attributeName.toUpperCase(),
    isArray: (tagName, jPath, isLeafNode, isAttribute) => {
        const upperJPath = jPath.toUpperCase();
        if (upperJPath === "CWEAPONINFOBLOB.INFOS.ITEM" || upperJPath === "CWEAPONINFOBLOB.INFOS.ITEM.INFOS.ITEM") {
            return true;
        }
        return false;
    }
  });

  const extractedDetails = {
    name: templateNameKey, path: templatePath, weaponId: null, modelName: null,
    displayName: null, audioItem: null, damage: null, range: null,
    ammoTypeRef: null, lodDistance: "500.0", reloadRate: null,
    fireRate: null, damageType: null, headshotMod: null,
  };

  try {
    if (await fs.pathExists(displayNamesPath)) {
      const dnContent = await fs.readFile(displayNamesPath, 'utf-8');
      extractedDetails.displayName = (JSON.parse(dnContent))[templateNameKey] || templateNameKey;
    } else {
      console.warn(`display_names.json not found at ${displayNamesPath}`);
      extractedDetails.displayName = templateNameKey;
    }

    if (await fs.pathExists(weaponMetaPath)) {
      const wmContent = await fs.readFile(weaponMetaPath, 'utf-8');
      const wmJson = parser.parse(wmContent);
      console.log("[main.js] Parsed weapons.meta (wmJson):", JSON.stringify(wmJson, null, 2));
      const blobRoot = wmJson.CWEAPONINFOBLOB;
      if (blobRoot?.INFOS?.ITEM?.[0]?.INFOS?.ITEM?.[0]) {
          const CWI = blobRoot.INFOS.ITEM[0].INFOS.ITEM[0];
          extractedDetails.weaponId = CWI.NAME || null;
          extractedDetails.modelName = CWI.MODEL || null;
          extractedDetails.audioItem = CWI.AUDIO || null;
          extractedDetails.damage = CWI.DAMAGE?.['@_VALUE'] !== undefined ? String(CWI.DAMAGE['@_VALUE']) : null;
          extractedDetails.range = CWI.WEAPONRANGE?.['@_VALUE'] !== undefined ? String(CWI.WEAPONRANGE['@_VALUE']) : null;
          extractedDetails.ammoTypeRef = CWI.AMMOINFO?.['@_REF'] || null;
          extractedDetails.reloadRate = CWI.ANIMRELOADRATE?.['@_VALUE'] !== undefined ? String(CWI.ANIMRELOADRATE['@_VALUE']) : null;
          extractedDetails.damageType = CWI.DAMAGETYPE || null;
          extractedDetails.headshotMod = CWI.HEADSHOTDAMAGEMODIFIERPLAYER?.['@_VALUE'] !== undefined ? String(CWI.HEADSHOTDAMAGEMODIFIERPLAYER['@_VALUE']) : null;
      } else { console.warn(`CWeaponInfo structure not found in ${weaponMetaPath}`); }
    } else { console.warn(`weapons.meta not found at ${weaponMetaPath}`); }

    if (await fs.pathExists(weaponAnimsPath)) {
        const waContent = await fs.readFile(weaponAnimsPath, 'utf-8');
        const waJson = parser.parse(waContent);
        const animSetsRoot = waJson.CWEAPONANIMATIONSSETS;

        if (animSetsRoot && animSetsRoot.WEAPONANIMATIONSSETS) {
            let animSetItems = animSetsRoot.WEAPONANIMATIONSSETS.ITEM;
            if (animSetItems && !Array.isArray(animSetItems)) {
                animSetItems = [animSetItems];
            } else if (!animSetItems) {
                animSetItems = [];
            }

            const defaultSet = animSetItems.find(set => set && set['@_KEY']?.toUpperCase() === 'DEFAULT');

            if (defaultSet && defaultSet.WEAPONANIMATIONS) {
                let weaponAnimEntries = defaultSet.WEAPONANIMATIONS.ITEM;
                if (weaponAnimEntries && !Array.isArray(weaponAnimEntries)) {
                    weaponAnimEntries = [weaponAnimEntries];
                } else if (!weaponAnimEntries) {
                    weaponAnimEntries = [];
                }

                const targetWeaponAnim = weaponAnimEntries.find(anim => anim && anim['@_KEY']?.toUpperCase() === templateNameKey.toUpperCase());

                if (targetWeaponAnim && targetWeaponAnim.ANIMFIRERATEMODIFIER && targetWeaponAnim.ANIMFIRERATEMODIFIER['@_VALUE'] !== undefined) {
                    extractedDetails.fireRate = String(targetWeaponAnim.ANIMFIRERATEMODIFIER['@_VALUE']);
                } else {
                    console.warn(`AnimFireRateModifier or relevant attributes not found for ${templateNameKey} in Default set.`);
                }
            } else {
                console.warn(`"Default" animation set or its WEAPONANIMATIONS node not found in ${weaponAnimsPath}`);
            }
        } else {
            console.warn(`CWEAPONANIMATIONSSETS or WEAPONANIMATIONSSETS node (or its ITEM) not found in ${weaponAnimsPath}`);
        }
    } else {
        console.warn(`weaponanimations.meta not found at ${weaponAnimsPath}`);
    }

    return { success: true, details: extractedDetails };
  } catch (error) {
    console.error(`Critical error in get-template-details for ${templatePath}:`, error);
    return { success: false, error: error.message, details: extractedDetails };
  }
});

ipcMain.handle('generate-addon', async (event, { templatePath, addonName, customYdrPath, customYtdPath, displayName, modelName: inputModelName }) => {
  console.log(`Generating addon: ${addonName} (ID) from template: ${templatePath}`);
  console.log(`Display Name: ${displayName}`);
  console.log(`Input Model Name: ${inputModelName}`);
  console.log(`Custom YDR: ${customYdrPath}, Custom YTD: ${customYtdPath}`);
  const outputDir = path.join(__dirname, 'output', addonName);
  try {
    await fs.ensureDir(outputDir);
    const templateFiles = await fs.readdir(templatePath);
    for (const file of templateFiles) {
      if (file.endsWith('.meta')) {
        const sourceFilePath = path.join(templatePath, file);
        const destFilePath = path.join(outputDir, file);
        let xmlContent = await fs.readFile(sourceFilePath, 'utf-8');
        const templateBaseName = path.basename(templatePath);
        const { XMLParser, XMLBuilder } = require('fast-xml-parser');
        const xmlParserInstance = new XMLParser({
          ignoreAttributes: false, attributeNamePrefix: "@_", allowBooleanAttributes: false,
          parseTagValue: true, parseAttributeValue: true, trimValues: true,
          cdataTagName: "__cdata", cdataPositionChar: "\\c",
          textNodeName: "_text", commentPropName: "__comment"
        });
        try {
          let jsonObj = xmlParserInstance.parse(xmlContent);
          function deepReplace(obj, search, replace) {
            for (const key in obj) {
              if (typeof obj[key] === 'string') {
                if (obj[key].includes(search)) {
                  obj[key] = obj[key].replace(new RegExp(search, 'g'), replace);
                }
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                deepReplace(obj[key], search, replace);
              }
            }
          }
          deepReplace(jsonObj, templateBaseName, addonName);
          const updateAssetPaths = (obj) => {
            if (obj && typeof obj === 'object') {
              if (obj.MODELNAME) {
                if (inputModelName) obj.MODELNAME = inputModelName;
                else if (customYdrPath && customYdrPath !== "default_model.ydr")
                  obj.MODELNAME = path.basename(customYdrPath, path.extname(customYdrPath));
              }
              if (obj.TEXTUREDICT && customYtdPath && customYtdPath !== "default_texture.ytd") {
                obj.TEXTUREDICT = path.basename(customYtdPath, path.extname(customYtdPath));
              }
              if (obj.CLIPMODELNAME) {
                if (inputModelName) obj.CLIPMODELNAME = inputModelName;
                else if (customYdrPath && customYdrPath !== "default_model.ydr")
                  obj.CLIPMODELNAME = path.basename(customYdrPath, path.extname(customYdrPath));
              }
              if (obj.CLIPTEXTUREDICT && customYtdPath && customYtdPath !== "default_texture.ytd") {
                obj.CLIPTEXTUREDICT = path.basename(customYtdPath, path.extname(customYtdPath));
              }
              for (const key in obj) {
                if (typeof obj[key] === 'object') updateAssetPaths(obj[key]);
                else if (Array.isArray(obj[key])) obj[key].forEach(item => updateAssetPaths(item));
              }
            }
          };
          updateAssetPaths(jsonObj);
          const builder = new XMLBuilder({
            ignoreAttributes: false, attributeNamePrefix: "@_", format: true,
            suppressEmptyNode: true, cdataTagName: "__cdata", cdataPositionChar: "\\c",
            textNodeName: "_text", commentPropName: "__comment"
          });
          xmlContent = builder.build(jsonObj);
        } catch (parseError) {
          console.error(`Error parsing/building XML for ${file}:`, parseError);
          xmlContent = xmlContent.replace(new RegExp(templateBaseName, 'g'), addonName);
          console.warn(`Fell back to naive string replacement for ${file}`);
        }
        await fs.writeFile(destFilePath, xmlContent, 'utf-8');
        console.log(`Copied and modified ${file} to ${destFilePath}`);
      }
    }
    if (customYdrPath && typeof customYdrPath === 'string' && customYdrPath !== "default_model.ydr") {
      await fs.ensureFile(path.join(outputDir, customYdrPath));
      console.log(`Placeholder for YDR: ${customYdrPath} in ${outputDir}`);
    }
    if (customYtdPath && typeof customYtdPath === 'string' && customYtdPath !== "default_texture.ytd") {
      await fs.ensureFile(path.join(outputDir, customYtdPath));
      console.log(`Placeholder for YTD: ${customYtdPath} in ${outputDir}`);
    }
    console.log(`Addon ${addonName} generated successfully in ${outputDir}`);
    return { success: true, message: `Addon ${addonName} generated in ${outputDir}` };
  } catch (error) {
    console.error(`Error generating addon ${addonName}:`, error);
    return { success: false, error: error.message };
  }
});

async function ensureDirectories() {
  try {
    await fs.ensureDir(path.join(__dirname, 'templates', 'weapons'));
    await fs.ensureDir(path.join(__dirname, 'output'));
    console.log("Required directories ensured.");
  } catch (err) {
    console.error("Error ensuring directories:", err);
  }
}

app.on('ready', async () => {
  await ensureDirectories();
});

ipcMain.handle('get-config-dropdown-options', async () => {
  const configOptionsPath = path.join(__dirname, 'config_options.json');
  try {
    if (await fs.pathExists(configOptionsPath)) {
      const fileContent = await fs.readFile(configOptionsPath, 'utf-8');
      const options = JSON.parse(fileContent);
      return { success: true, options };
    } else {
      console.error(`config_options.json not found at ${configOptionsPath}`);
      return { success: false, error: 'config_options.json not found.' };
    }
  } catch (error) {
    console.error('Error reading or parsing config_options.json:', error);
    return { success: false, error: error.message };
  }
});

module.exports = {
  scanWeaponTemplatesLogic
};

ipcMain.handle('scan-component-templates', async () => {
  const componentsDir = path.join(__dirname, 'templates', 'components');
  try {
    console.log(`[scan-component-templates] Attempting to read directory: ${componentsDir}`);
    
    const componentFolders = await fs.readdir(componentsDir, { withFileTypes: true });
    const templates = componentFolders
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        path: path.join(componentsDir, dirent.name)
      }));
    console.log('[scan-component-templates] Scanned component templates:', templates);
    return { success: true, templates };
  } catch (error) {
    console.error(`[scan-component-templates] Error scanning component templates in ${componentsDir}:`, error);
    return { success: false, error: error.message, templates: [] };
  }
});

ipcMain.handle('get-component-template-details', async (event, componentTemplatePath) => {
  const componentMetaFilePath = path.join(componentTemplatePath, 'weaponcomponents.meta');

  const { XMLParser } = require('fast-xml-parser');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    transformTagName: (tagName) => tagName.toUpperCase(),
    transformAttributeName: (attributeName) => attributeName.toUpperCase(),
    isArray: (tagName, jPath, isLeafNode, isAttribute) => {
        const upperJPath = jPath.toUpperCase();
        if (upperJPath === "CWEAPONINFOBLOB.INFOS.ITEM" ||
            upperJPath === "CWEAPONINFOBLOB.INFOS.ITEM.INFOS.ITEM" ||
            upperJPath === "CWEAPONCOMPONENTINFOBLOB.INFOS.ITEM") {
            return true;
        }
        return false;
    }
  });

  const details = {
    componentName: null,
    modelName: null,
    clipSize: null,
    ammoInfoRef: "",
    hasClipSizeTag: false
  };

  try {
    if (await fs.pathExists(componentMetaFilePath)) {
      const fileContent = await fs.readFile(componentMetaFilePath, 'utf-8');
      const inspectionParser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
          parseAttributeValue: true,
          isArray: (tagName, jPath, isLeafNode, isAttribute) => {
              if (jPath.toUpperCase() === "CWEAPONCOMPONENTINFOBLOB.INFOS.ITEM") return true;
              return false;
          }
      });
      const parsedXml = inspectionParser.parse(fileContent);

      const blobRoot = parsedXml.CWeaponComponentInfoBlob;
      if (blobRoot && blobRoot.Infos && blobRoot.Infos.Item && blobRoot.Infos.Item[0]) {
        const componentDataItem = blobRoot.Infos.Item[0];

        details.componentName = componentDataItem.Name || null;
        details.modelName = componentDataItem.Model || null;

        if (componentDataItem.hasOwnProperty('ClipSize')) {
            details.hasClipSizeTag = true;
            if (componentDataItem.ClipSize && componentDataItem.ClipSize['@_value'] !== undefined) {
                 details.clipSize = String(componentDataItem.ClipSize['@_value']);
            } else {
                details.clipSize = null;
            }
        } else {
            details.hasClipSizeTag = false;
            details.clipSize = null;
        }

        if (componentDataItem.AmmoInfo !== undefined) {
            if (typeof componentDataItem.AmmoInfo === 'string') {
                 details.ammoInfoRef = componentDataItem.AmmoInfo;
            } else if (componentDataItem.AmmoInfo && componentDataItem.AmmoInfo['#text'] !== undefined) {
                 details.ammoInfoRef = componentDataItem.AmmoInfo['#text'];
            } else {
                 details.ammoInfoRef = "";
            }
        } else {
            details.ammoInfoRef = "";
        }

      } else {
        console.warn(`Could not find CWeaponComponentInfoBlob.Infos.Item structure in ${componentMetaFilePath}`);
      }
    } else {
      console.warn(`Component meta file not found: ${componentMetaFilePath}`);
      return { success: false, error: `File not found: ${componentMetaFilePath}` };
    }
    return { success: true, details };
  } catch (error) {
    console.error(`Error reading or parsing component meta file ${componentMetaFilePath}:`, error);
    return { success: false, error: error.message, details };
  }
});


ipcMain.handle('open-folder-dialog', async () => {
  if (!mainWindow) {
    console.error('Main window not available for dialog.');
    return { success: false, path: null, error: "Main window not found." };
  }
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Folder',
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) {
      return { success: false, path: null, message: 'Folder selection canceled.' };
    }
    return { success: true, path: filePaths[0] };
  } catch (error) {
    console.error('Error opening folder dialog:', error);
    return { success: false, path: null, error: error.message };
  }
});

ipcMain.handle('scan-directory-for-assets', async (event, directoryPath) => {
  if (!directoryPath || typeof directoryPath !== 'string') {
    return { success: false, error: 'Invalid directory path provided.', files: [] };
  }
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const assetFiles = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const lowerCaseName = entry.name.toLowerCase();
        if (lowerCaseName.endsWith('.ydr') || lowerCaseName.endsWith('.ytd')) {
          assetFiles.push(path.join(directoryPath, entry.name));
        }
      }
    }
    return { success: true, files: assetFiles };
  } catch (error) {
    console.error(`Error scanning directory ${directoryPath} for assets:`, error);
    return { success: false, error: `Failed to scan directory: ${error.message}`, files: [] };
  }
});

ipcMain.handle('perform-final-export', async (event, exportData) => {
  console.log('[Main Process] Received perform-final-export request:');
  console.log(JSON.stringify(exportData, null, 2));

  const { exportPath, weaponDetails, importedFilePaths, components: componentsData } = exportData;

  const { XMLParser: EarlyXMLParser } = require('fast-xml-parser');
  const earlyCompParserOptions = {
      ignoreAttributes: false, attributeNamePrefix: "@_", parseAttributeValue: false,
      allowBooleanAttributes: false, textNodeName: "#text",
      transformTagName: (tagName) => tagName, transformAttributeName: (attrName) => attrName,
      isArray: (tagName, jPath) => jPath === "CWeaponComponentInfoBlob.Infos.Item"
  };
  const earlyCompParser = new EarlyXMLParser(earlyCompParserOptions);
  
  let attachableComponentsData = [];
  if (componentsData && componentsData.length > 0) {
    for (const component of componentsData) {
      if (!component.templatePath || !component.name) {
        console.warn(`[AttachPoints] Component missing templatePath or name, skipping for AttachPoints: ${JSON.stringify(component)}`);
        continue;
      }
      try {
        const componentMetaPath = path.join(component.templatePath, 'weaponcomponents.meta');
        if (await fs.pathExists(componentMetaPath)) {
          const compXmlContent = await fs.readFile(componentMetaPath, 'utf-8');
          const parsedComp = earlyCompParser.parse(compXmlContent);
          
          let weaponAttachBone = null;
          if (parsedComp.CWeaponComponentInfoBlob && 
              parsedComp.CWeaponComponentInfoBlob.Infos &&
              parsedComp.CWeaponComponentInfoBlob.Infos.Item &&
              parsedComp.CWeaponComponentInfoBlob.Infos.Item[0] &&
              parsedComp.CWeaponComponentInfoBlob.Infos.Item[0].WeaponAttachBone) {
            
            const rawBone = parsedComp.CWeaponComponentInfoBlob.Infos.Item[0].WeaponAttachBone;
            if (typeof rawBone === 'string') {
              weaponAttachBone = rawBone;
            } else if (typeof rawBone === 'object' && rawBone !== null && rawBone['#text'] !== undefined) {
              weaponAttachBone = rawBone['#text'];
            } else if (typeof rawBone === 'object' && rawBone !== null && Object.keys(rawBone).length === 0) {
              weaponAttachBone = "";
            }
          }

          if (weaponAttachBone !== null && weaponAttachBone.trim() !== "") {
            attachableComponentsData.push({
              componentName: component.name,
              weaponAttachBone: weaponAttachBone.trim(),
              isEnabled: component.enabled === true
            });
          } else {
            console.warn(`[AttachPoints] WeaponAttachBone not found or empty in ${componentMetaPath} for component ${component.name}.`);
          }
        } else {
          console.warn(`[AttachPoints] Component meta file not found: ${componentMetaPath} for component ${component.name}.`);
        }
      } catch (err) {
        console.error(`[AttachPoints] Error processing component ${component.name} for AttachPoints: ${err.message}`);
      }
    }
  }
  console.log('[AttachPoints] Gathered attachable components data:', JSON.stringify(attachableComponentsData, null, 2));

  const groupedComponents = new Map();
  for (const compData of attachableComponentsData) {
    if (!groupedComponents.has(compData.weaponAttachBone)) {
      groupedComponents.set(compData.weaponAttachBone, []);
    }
    groupedComponents.get(compData.weaponAttachBone).push({
      componentName: compData.componentName,
      isEnabled: compData.isEnabled
    });
  }
  console.log('[AttachPoints] Grouped components by WeaponAttachBone:', JSON.stringify(Array.from(groupedComponents.entries()), null, 2));

  let componentArchetypeInfoList = [];
  if (componentsData && componentsData.length > 0) {
    for (const component of componentsData) {
      if (!component.modelName || component.modelName.trim() === "") {
        console.warn(`[Archetype] Component missing user-defined modelName, skipping for archetype. Component name: ${component.name || 'N/A'}`);
        continue;
      }
      const lodDistance = component.lodDistance !== undefined && component.lodDistance !== null 
                          ? String(component.lodDistance) 
                          : "100.0";

      componentArchetypeInfoList.push({
        modelNameFromUI: component.modelName.trim(), 
        lodDistanceFromUI: lodDistance 
      });
    }
  }
  console.log('[Archetype] Gathered component archetype info list (from UI data):', JSON.stringify(componentArchetypeInfoList, null, 2));


  if (!exportPath || !weaponDetails || !weaponDetails.displayName || !importedFilePaths) {
    console.error('Export data is missing crucial information.');
    return { success: false, error: 'Export data incomplete. Ensure export path, weapon display name, and imported files are provided.' };
  }

  const weaponFolderName = weaponDetails.displayName.replace(/[^a-zA-Z0-9_]/g, '_');
  const rootExportDir = path.join(exportPath, weaponFolderName);
  const streamDir = path.join(rootExportDir, 'stream');
  const dataDir = path.join(rootExportDir, 'data');
  const fxManifestPath = path.join(rootExportDir, 'fxmanifest.lua');

  try {
    await fs.ensureDir(rootExportDir);
    console.log(`Ensured root export directory: ${rootExportDir}`);
    await fs.ensureDir(streamDir);
    console.log(`Ensured stream directory: ${streamDir}`);
    await fs.ensureDir(dataDir);
    console.log(`Ensured data directory: ${dataDir}`);

    const authorName = weaponDetails.displayName || 'Default Author';
    const descriptionText = `Custom weapon: ${weaponDetails.displayName || weaponDetails.weaponId || 'Unknown Weapon'}`;
    const resourceVersion = weaponDetails.version || '1.1.5';

    const fxManifestContent = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author '${authorName}'
description '${descriptionText}'
version '${resourceVersion}'

files {
  'data/**/weaponcomponents.meta',
  'data/**/weaponarchetypes.meta',
  'data/**/weaponanimations.meta',
  'data/**/pedpersonality.meta',
  'data/**/weapons.meta',
}

data_file 'WEAPONCOMPONENTSINFO_FILE' '**/weaponcomponents.meta'
data_file 'WEAPON_METADATA_FILE' '**/weaponarchetypes.meta'
data_file 'WEAPON_ANIMATIONS_FILE' '**/weaponanimations.meta'
data_file 'PED_PERSONALITY_FILE' '**/pedpersonality.meta'
data_file 'WEAPONINFO_FILE' '**/weapons.meta'
`;
    await fs.writeFile(fxManifestPath, fxManifestContent.trim(), 'utf-8');
    console.log(`Created fxmanifest.lua at: ${fxManifestPath} with new content.`);

    const templateWeaponMetaPath = path.join(weaponDetails.baseTemplatePath, 'weapons.meta');
    if (await fs.pathExists(templateWeaponMetaPath)) {
      const { XMLParser, XMLBuilder } = require('fast-xml-parser');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseAttributeValue: true,
        transformTagName: (tagName) => tagName,
        transformAttributeName: (attributeName) => attributeName,
        isArray: (tagName, jPath, isLeafNode, isAttribute) => {
            const arrayPaths = [
                "CWeaponInfoBlob.SlotNavigateOrder.Item",
                "CWeaponInfoBlob.SlotNavigateOrder.Item.WeaponSlots.Item",
                "CWeaponInfoBlob.Infos.Item",
                "CWeaponInfoBlob.Infos.Item.Infos.Item",
                "CWeaponInfoBlob.Infos.Item.Infos.Item.OverrideForces.Item",
                "CWeaponInfoBlob.Infos.Item.Infos.Item.AttachPoints.Item",
                "CWeaponInfoBlob.Infos.Item.Infos.Item.AttachPoints.Item.Components.Item"
            ];
            return arrayPaths.includes(jPath);
        },
        allowBooleanAttributes: false,
        textNodeName: "#text"
      });
      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        format: true,
        suppressEmptyNode: false,
        textNodeName: "#text"
      });

      function ensurePath(obj, pathParts) {
        let current = obj;
        for (const part of pathParts) {
            if (part.endsWith('[0]')) {
                const arrayKey = part.substring(0, part.length - 3);
                if (!current[arrayKey]) {
                    current[arrayKey] = [];
                }
                if (!current[arrayKey][0]) {
                    current[arrayKey][0] = {};
                }
                current = current[arrayKey][0];
            } else {
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        }
        return current;
      }

      /**
       * @param {object} obj 
       * @param {string[] | null} keysToConsider
       * @param {string[]} attributeKeys
       * @param {string} textNodeName
       */
      function transformPrimitivesToTextObjects(obj, keysToConsider, attributeKeys, textNodeName = "#text") {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return;
        }

        const processableKeys = keysToConsider || Object.keys(obj);

        for (const key of processableKeys) {
            if (obj.hasOwnProperty(key) && !attributeKeys.includes(key)) {
                const value = obj[key];
                if (value !== null && typeof value !== 'object') {
                    obj[key] = { [textNodeName]: String(value) };
                }
            }
        }
      }

      try {
        const xmlStr = await fs.readFile(templateWeaponMetaPath, 'utf-8');
        let weaponMetaObj = parser.parse(xmlStr);

        if (!weaponMetaObj.CWeaponInfoBlob) {
            weaponMetaObj.CWeaponInfoBlob = {};
        }
        const blob = weaponMetaObj.CWeaponInfoBlob;
        if (!blob.Name) {
            console.log("[weapons.meta] Root <Name> tag missing in CWeaponInfoBlob, adding default 'AR'.");
            blob.Name = { "#text": "AR" };
        } else if (typeof blob.Name === 'string') {
            console.log(`[weapons.meta] Ensuring root <Name> tag ('${blob.Name}') is structured for child tag output.`);
            blob.Name = { "#text": blob.Name };
        }


        ensurePath(blob, ["Infos", "Item[0]", "Infos", "Item[0]"]);
        let CWI = blob.Infos.Item[0].Infos.Item[0];

        CWI.type = "CWeaponInfo";

        const cwiAttributeKeys = ["type"];
        const cwiSimpleTextChildKeys = [
            "Name", "Model", "Audio", "Slot", "DamageType", "HumanNameHash", "FireType",
            "WheelSlot", "Group", "StatName", "NmShotTuningSet", "WeaponFlags",
            "AudioCollisionHash", "PickupHash", "MPPickupHash", "RecoilShakeHash",
            "RecoilShakeHashFirstPerson", "AccuracyOffsetShakeHash", "DefaultCameraHash",
            "CoverCameraHash", "CoverReadyToFireCameraHash", "RunAndGunCameraHash",
            "CinematicShootingCameraHash", "AlternativeOrScopedCameraHash",
            "RunAndGunAlternativeOrScopedCameraHash", "CinematicShootingAlternativeOrScopedCameraHash",
            "VehicleWeaponHash",
            "ReticuleStyleHash", "FirstPersonReticuleStyleHash", "MovementModeConditionalIdle"
        ];

        transformPrimitivesToTextObjects(CWI, cwiSimpleTextChildKeys, cwiAttributeKeys);

        const emptyParentTags = ["AttachPoints", "GunFeedBone", "TargetSequenceGroup"];
        for (const tagName of emptyParentTags) {
            if (CWI.hasOwnProperty(tagName)) {
                if (CWI[tagName] === "" || (CWI[tagName] && CWI[tagName]["#text"] === "")) {
                    CWI[tagName] = {};
                }
            } else {
            }
        }

        if (CWI.Explosion && typeof CWI.Explosion === 'object') {
            transformPrimitivesToTextObjects(CWI.Explosion, null, []);
        }

        if (CWI.Fx && typeof CWI.Fx === 'object') {
            transformPrimitivesToTextObjects(CWI.Fx, null, []);
            const fxEmptyTextChildTags = [
                "FlashFxAltFP", "GroundDisturbFxNameDefault", "GroundDisturbFxNameSand",
                "GroundDisturbFxNameDirt", "GroundDisturbFxNameWater", "GroundDisturbFxNameFoliage"
            ];
            for (const tagName of fxEmptyTextChildTags) {
                if (CWI.Fx.hasOwnProperty(tagName) && CWI.Fx[tagName] && CWI.Fx[tagName]["#text"] === "") {
                    CWI.Fx[tagName] = {};
                }
            }
        }

        const slotOrderItemPath = ensurePath(blob, ["SlotNavigateOrder", "Item[0]", "WeaponSlots", "Item[0]"]);

        for (const key in slotOrderItemPath) {
            delete slotOrderItemPath[key];
        }
        slotOrderItemPath.OrderNumber = { value: "551" };
        slotOrderItemPath.Entry = { "#text": `SLOT_${weaponDetails.weaponId}` };


        if (CWI) {
          const weaponId = weaponDetails.weaponId;
          const modelName = weaponDetails.modelName;

          CWI.Name = { "#text": weaponId };
          CWI.Model = { "#text": modelName };
          CWI.HumanNameHash = { "#text": weaponId };
          CWI.Slot = { "#text": `SLOT_${weaponId}` };

          if (exportData.configurations.damageType) CWI.DamageType = { "#text": exportData.configurations.damageType };
          if (exportData.configurations.audioItem) CWI.Audio = { "#text": exportData.configurations.audioItem };

          if (exportData.configurations.weaponDamage) {
            CWI.Damage = { value: exportData.configurations.weaponDamage };
          }
          if (exportData.configurations.weaponRange) {
            CWI.WeaponRange = { value: exportData.configurations.weaponRange };
          }
          if (exportData.configurations.ammoType) {
            CWI.AmmoInfo = { ref: exportData.configurations.ammoType };
          }
          if (exportData.configurations.reloadSpeed) {
            CWI.AnimReloadRate = { value: exportData.configurations.reloadSpeed };
          }
          if (exportData.configurations.headshotModifier) {
            CWI.HeadShotDamageModifierPlayer = { value: exportData.configurations.headshotModifier };
          }

          delete CWI.Entry;

          if (!CWI.AttachPoints) {
            CWI.AttachPoints = {};
          }
          if (!CWI.AttachPoints.Item) {
            CWI.AttachPoints.Item = [];
          }
          
          if (groupedComponents.size > 0) {
            for (const [boneName, componentsOnBone] of groupedComponents) {
              let existingAttachPoint = CWI.AttachPoints.Item.find(p => p.AttachBone && p.AttachBone["#text"] === boneName);
              
              if (existingAttachPoint) {
                if (!existingAttachPoint.Components) {
                  existingAttachPoint.Components = { Item: [] };
                }
                if (!existingAttachPoint.Components.Item) {
                  existingAttachPoint.Components.Item = [];
                }
              } else {
                existingAttachPoint = {
                  AttachBone: { "#text": boneName },
                  Components: { Item: [] }
                };
                CWI.AttachPoints.Item.push(existingAttachPoint);
              }
              
              for (const comp of componentsOnBone) {
                existingAttachPoint.Components.Item.push({
                  Name: { "#text": comp.componentName },
                  Default: { "value": comp.isEnabled }
                });
              }
            }
          }
          console.log('[AttachPoints] Reconstructed CWI.AttachPoints:', JSON.stringify(CWI.AttachPoints, null, 2));


          if (CWI.OverrideForces && Array.isArray(CWI.OverrideForces.Item)) {
            CWI.OverrideForces.Item.forEach(item => {
              if (item.ForceFront && typeof item.ForceFront.value !== 'undefined') {
                const num = parseFloat(item.ForceFront.value);
                if (!isNaN(num)) {
                  item.ForceFront.value = num.toFixed(6);
                }
              }
              if (item.ForceBack && typeof item.ForceBack.value !== 'undefined') {
                const num = parseFloat(item.ForceBack.value);
                if (!isNaN(num)) {
                  item.ForceBack.value = num.toFixed(6);
                }
              }
            });
          }
          if (CWI.OverrideForces && Array.isArray(CWI.OverrideForces.Item)) {
            CWI.OverrideForces.Item.forEach(item => {
              if (item.hasOwnProperty('BoneTag') && typeof item.BoneTag === 'string') {
                const boneTagValue = item.BoneTag;
                delete item.BoneTag;
                item.BoneTag = { "#text": boneTagValue };
              }
            });
          }

          let outputXml = builder.build(weaponMetaObj);

          outputXml = outputXml.replace(/<Default value><\/Default>/g, '<Default value="true"></Default>');
          outputXml = outputXml.replace(/<Default value\/>/g, '<Default value="true"/>');

          outputXml = outputXml.replace(/<FlashFxLightEnabled value><\/FlashFxLightEnabled>/g, '<FlashFxLightEnabled value="true"></FlashFxLightEnabled>');
          outputXml = outputXml.replace(/<FlashFxLightEnabled value\/>/g, '<FlashFxLightEnabled value="true"/>');
          
          const destWeaponMetaPath = path.join(dataDir, 'weapons.meta');
          await fs.writeFile(destWeaponMetaPath, outputXml, 'utf-8');
          console.log(`Processed and wrote weapons.meta to ${destWeaponMetaPath}`);

        } else {
          console.warn(`Could not find CWeaponInfo structure in template ${templateWeaponMetaPath} to modify.`);
        }
      } catch (xmlError) {
        console.error(`Error processing XML for ${templateWeaponMetaPath}:`, xmlError);
        return { success: false, error: `Failed to process weapons.meta: ${xmlError.message}` };
      }
    } else {
      console.warn(`Template weapons.meta not found at ${templateWeaponMetaPath}. Skipping weapons.meta generation.`);
    }
    let templateOriginalSpawnName = weaponDetails.baseTemplateName;
    const originalTemplateWeaponMetaPath = path.join(weaponDetails.baseTemplatePath, 'weapons.meta');
    if (await fs.pathExists(originalTemplateWeaponMetaPath)) {
        try {
            const tempParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "#text", isArray: (tn, jp) => jp === "CWeaponInfoBlob.Infos.Item.Infos.Item" });
            const tempXmlStr = await fs.readFile(originalTemplateWeaponMetaPath, 'utf-8');
            const tempWeaponMetaObj = tempParser.parse(tempXmlStr);
            const tempCWI = tempWeaponMetaObj?.CWeaponInfoBlob?.Infos?.Item[0]?.Infos?.Item[0];
            if (tempCWI && tempCWI.Name) {
                templateOriginalSpawnName = (typeof tempCWI.Name === 'object' && tempCWI.Name["#text"]) ? tempCWI.Name["#text"] : tempCWI.Name;
                if(!templateOriginalSpawnName) templateOriginalSpawnName = weaponDetails.baseTemplateName;
                 console.log(`Determined templateOriginalSpawnName from template weapons.meta: ${templateOriginalSpawnName}`);
            } else {
                console.warn(`Could not determine original spawn name from template weapons.meta, falling back to folder name: ${templateOriginalSpawnName}`);
            }
        } catch (e) {
            console.warn(`Error parsing template weapons.meta for original spawn name, falling back to folder name: ${templateOriginalSpawnName}. Error: ${e.message}`);
        }
    } else {
         console.warn(`Template weapons.meta not found at ${originalTemplateWeaponMetaPath} for determining original spawn name. Using folder name: ${templateOriginalSpawnName}`);
    }


    const templateWeaponAnimsPath = path.join(weaponDetails.baseTemplatePath, 'weaponanimations.meta');
    const newWeaponId = weaponDetails.weaponId;

    if (await fs.pathExists(templateWeaponAnimsPath)) {
        try {
            let contentWithNewId = await fs.readFile(templateWeaponAnimsPath, 'utf-8');
            const regex = new RegExp(templateOriginalSpawnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            contentWithNewId = contentWithNewId.replace(regex, newWeaponId);
            console.log(`[weaponanimations.meta] Performed initial spawn name replacement: ${templateOriginalSpawnName} -> ${newWeaponId}`);

            const { XMLParser, XMLBuilder } = require('fast-xml-parser');
            const animParserOptions = {
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                parseAttributeValue: true,
                allowBooleanAttributes: true,
                textNodeName: "#text",
                isArray: (tagName, jPath, isLeafNode, isAttribute) => {
                    const upperJPath = jPath.toUpperCase();
                    if (upperJPath === "CWEAPONANIMATIONSSETS.WEAPONANIMATIONSSETS.ITEM" || 
                        upperJPath === "CWEAPONANIMATIONSSETS.WEAPONANIMATIONSSETS.ITEM.WEAPONANIMATIONS.ITEM") {
                        return true;
                    }
                    return false; 
                }
            };
            const animParser = new XMLParser(animParserOptions);
            let animJsObject = animParser.parse(contentWithNewId);


            const userFireRate = exportData.configurations?.fireRate;
            if (userFireRate !== undefined && userFireRate !== null) {
                console.log(`[weaponanimations.meta] User defined Fire Rate: ${userFireRate} - will update all AnimFireRateModifier tags.`);
                const fireRateStr = String(userFireRate);

                function updateAllFireRateModifiers(obj) {
                    if (typeof obj !== 'object' || obj === null) {
                        return;
                    }

                    if (obj.hasOwnProperty('AnimFireRateModifier')) {
                        if (typeof obj.AnimFireRateModifier !== 'object' || obj.AnimFireRateModifier === null) {
                            obj.AnimFireRateModifier = {};
                        }
                        console.log(`[weaponanimations.meta] Updating an AnimFireRateModifier from '${obj.AnimFireRateModifier['@_value']}' to '${fireRateStr}'`);
                        obj.AnimFireRateModifier['@_value'] = fireRateStr;
                    }

                    for (const key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            if (typeof obj[key] === 'object' && obj[key] !== null) {
                                updateAllFireRateModifiers(obj[key]);
                            } else if (Array.isArray(obj[key])) {
                                obj[key].forEach(item => updateAllFireRateModifiers(item));
                            }
                        }
                    }
                }
                updateAllFireRateModifiers(animJsObject);

            } else {
                console.log('[weaponanimations.meta] User defined Fire Rate not provided. AnimFireRateModifier tags will not be changed.');
            }

            const animBuilderOptions = {
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                format: true,
                textNodeName: "#text",
                suppressEmptyNode: false,
            };
            const animBuilder = new XMLBuilder(animBuilderOptions);
            let outputXml = animBuilder.build(animJsObject);

            outputXml = outputXml.replace(/<UseFromStrafeUpperBodyAimNetwork value><\/UseFromStrafeUpperBodyAimNetwork>/g, '<UseFromStrafeUpperBodyAimNetwork value="true"></UseFromStrafeUpperBodyAimNetwork>');
            outputXml = outputXml.replace(/<UseFromStrafeUpperBodyAimNetwork value\/>/g, '<UseFromStrafeUpperBodyAimNetwork value="true"/>');
            
            outputXml = outputXml.replace(/<AimingDownTheBarrel value><\/AimingDownTheBarrel>/g, '<AimingDownTheBarrel value="true"></AimingDownTheBarrel>');
            outputXml = outputXml.replace(/<AimingDownTheBarrel value\/>/g, '<AimingDownTheBarrel value="true"/>');
            
            const destWeaponAnimsPath = path.join(dataDir, 'weaponanimations.meta');
            await fs.writeFile(destWeaponAnimsPath, outputXml, 'utf-8');
            console.log(`Processed and wrote modified weaponanimations.meta to ${destWeaponAnimsPath}`);

        } catch (animError) {
            console.error(`Error processing weaponanimations.meta: ${animError.message}`);
        }
    } else {
        console.warn(`Template weaponanimations.meta not found at ${templateWeaponAnimsPath}. Skipping.`);
    }

    const templatePedPersonalityPath = path.join(weaponDetails.baseTemplatePath, 'pedpersonality.meta');
    if (await fs.pathExists(templatePedPersonalityPath)) {
        try {
            let content = await fs.readFile(templatePedPersonalityPath, 'utf-8');
            const regex = new RegExp(templateOriginalSpawnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            content = content.replace(regex, newWeaponId);

            const destPedPersonalityPath = path.join(dataDir, 'pedpersonality.meta');
            await fs.writeFile(destPedPersonalityPath, content, 'utf-8');
            console.log(`Processed and wrote pedpersonality.meta to ${destPedPersonalityPath}`);
        } catch (pedError) {
            console.error(`Error processing pedpersonality.meta: ${pedError.message}`);
        }
    } else {
        console.warn(`Template pedpersonality.meta not found at ${templatePedPersonalityPath}. Skipping.`);
    }

    if (exportData.metaFiles) {
        if (exportData.metaFiles.weaponarchetypes) {
            let archetypeMetaContent = exportData.metaFiles.weaponarchetypes.content;

            if (archetypeMetaContent && componentArchetypeInfoList.length > 0) {
                const { XMLParser: ArchetypeParser, XMLBuilder: ArchetypeBuilder } = require('fast-xml-parser');
                
                const archetypeParserOptions = {
                    ignoreAttributes: false,
                    attributeNamePrefix: "",
                    parseAttributeValue: true,
                    textNodeName: "#text",
                    allowBooleanAttributes: true,
                    isArray: (tagName, jPath, isLeafNode, isAttribute) => {
                        return jPath === "CWeaponModelInfo__InitDataList.InitDatas.Item";
                    }
                };
                const archetypeBuilderOptions = {
                    ignoreAttributes: false,
                    attributeNamePrefix: "",
                    format: true,
                    textNodeName: "#text",
                    suppressEmptyNode: false,
                };

                const parser = new ArchetypeParser(archetypeParserOptions);
                let archetypeJsObject;
                try {
                    archetypeJsObject = parser.parse(archetypeMetaContent);
                } catch (parseErr) {
                    console.error(`[Archetype] Error parsing existing weaponarchetypes.meta content: ${parseErr.message}. Skipping component additions.`);
                    archetypeJsObject = null;
                }

                if (archetypeJsObject) {
                    if (!archetypeJsObject.CWeaponModelInfo__InitDataList) {
                        archetypeJsObject.CWeaponModelInfo__InitDataList = { InitDatas: { Item: [] } };
                    } else if (!archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas) {
                        archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas = { Item: [] };
                    } else if (!archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item) {
                        archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item = [];
                    } else if (!Array.isArray(archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item)) {
                        archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item = [archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item];
                    }

                    const items = archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item;
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const fieldsToEnsureAsChildTags = ['modelName', 'txdName', 'ptfxAssetName'];
                        fieldsToEnsureAsChildTags.forEach(field => {
                            if (item.hasOwnProperty(field) && typeof item[field] === 'string') {
                                const val = item[field];
                                delete item[field];
                                item[field] = { "#text": val };
                                console.log(`[Archetype] Transformed ${field} to child tag for existing item.`);
                            }
                        });
                    }
                    
                    for (const compInfo of componentArchetypeInfoList) {
                        const newArchItem = {
                            modelName: { "#text": compInfo.modelNameFromUI },
                            txdName: { "#text": compInfo.modelNameFromUI },
                            ptfxAssetName: { "#text": "NULL" },
                            lodDist: { "value": String(compInfo.lodDistanceFromUI) } 
                        };
                        archetypeJsObject.CWeaponModelInfo__InitDataList.InitDatas.Item.push(newArchItem);
                        console.log(`[Archetype] Added item for component ${compInfo.modelNameFromUI} to weaponarchetypes.meta`);
                    }

                    const builder = new ArchetypeBuilder(archetypeBuilderOptions);
                    archetypeMetaContent = builder.build(archetypeJsObject);
                }
            }
            
            const finalDestPath = path.join(dataDir, 'weaponarchetypes.meta');
            try {
                await fs.outputFile(finalDestPath, archetypeMetaContent, 'utf-8');
                console.log(`Wrote weaponarchetypes.meta to ${finalDestPath}`);
            } catch (writeError) {
                console.error(`Error writing weaponarchetypes.meta to ${finalDestPath}:`, writeError);
            }

        } else {
            console.warn('weaponarchetypes.meta data or content missing in exportData.metaFiles.');
        }
    }

    try {
        const { XMLParser, XMLBuilder } = require('fast-xml-parser');
        const compParserOptions = {
            ignoreAttributes: false, attributeNamePrefix: "@_", parseAttributeValue: false,
            allowBooleanAttributes: false, textNodeName: "#text",
            transformTagName: (tagName) => tagName, transformAttributeName: (attrName) => attrName,
            isArray: (tagName, jPath) => jPath === "CWeaponComponentInfoBlob.Infos.Item"
        };

        const compBuilderOptions = {
            ignoreAttributes: false, attributeNamePrefix: "@_", format: true,
            suppressEmptyNode: false,
            textNodeName: "#text",
            transformTagName: (tagName) => tagName, transformAttributeName: (attrName) => attrName,
        };
        const compParser = new XMLParser(compParserOptions);
        const compBuilder = new XMLBuilder(compBuilderOptions);

        const wcMetaJsObject = {
            CWeaponComponentInfoBlob: {
                Infos: { Item: [] },
                InfoBlobName: {}
            }
        };

        if (componentsData && componentsData.length > 0) {
            for (const component of componentsData) {
                if (!component.templatePath) {
                    console.warn(`Skipping component ${component.componentName || 'Unknown'} due to missing template path.`);
                    continue;
                }
                try {
                    const actualTemplateFilePath = path.join(component.templatePath, 'weaponcomponents.meta');
                    console.log('[WC-META] Processing component:', component.name, 'with template file:', actualTemplateFilePath);
                    const templateXmlString = await fs.readFile(actualTemplateFilePath, 'utf-8');
                    let parsedTemplate = compParser.parse(templateXmlString);
                    let itemObjectToClone = null;

                    console.log('[WC-META] Parsed template structure:', JSON.stringify(parsedTemplate, null, 2).substring(0, 500));

                    if (parsedTemplate.CWeaponComponentInfoBlob &&
                        parsedTemplate.CWeaponComponentInfoBlob.Infos &&
                        parsedTemplate.CWeaponComponentInfoBlob.Infos.Item) {
                        const itemsArray = Array.isArray(parsedTemplate.CWeaponComponentInfoBlob.Infos.Item)
                                           ? parsedTemplate.CWeaponComponentInfoBlob.Infos.Item
                                           : [parsedTemplate.CWeaponComponentInfoBlob.Infos.Item];
                        if (itemsArray.length > 0) {
                            itemObjectToClone = itemsArray[0];
                        }
                    }

                    if (itemObjectToClone) {
                        let itemObject = JSON.parse(JSON.stringify(itemObjectToClone));

                        itemObject.Name = { "#text": component.name };
                        itemObject.Model = { "#text": component.modelName };

                        if (component.hasClipSizeTag && itemObject.hasOwnProperty('ClipSize')) {
                            itemObject.ClipSize = { "@_value": String(component.clipSize) };
                        } else if (!component.hasClipSizeTag && itemObject.hasOwnProperty('ClipSize')) {
                            delete itemObject.ClipSize;
                        }

                        if (itemObject.hasOwnProperty('AmmoInfo')) {
                            itemObject.AmmoInfo = { "#text": component.ammoInfo || "" };
                        }

                        console.log('[WC-META] Modified itemObject for', component.name, ' (default handling, pre-string-fix):', JSON.stringify(itemObject, null, 2));
                        wcMetaJsObject.CWeaponComponentInfoBlob.Infos.Item.push(itemObject);
                    } else {
                        console.warn(`[WC-META] Could not find valid <Item> in template ${actualTemplateFilePath} for ${component.componentName}. itemObjectToClone is:`, itemObjectToClone);
                    }
                } catch (err) {
                    console.error(`Error processing component template ${actualTemplateFilePath} for ${component.componentName}: ${err.message}`);
                }
            }
        }

        if (wcMetaJsObject.CWeaponComponentInfoBlob.Infos.Item.length === 0) {
        }
        console.log('[WC-META] Final wcMetaJsObject before build:', JSON.stringify(wcMetaJsObject, null, 2));
        let builtXmlString = compBuilder.build(wcMetaJsObject);

        builtXmlString = builtXmlString.replace(/<CreateObject value><\/CreateObject>/g, '<CreateObject value="true"></CreateObject>');
        builtXmlString = builtXmlString.replace(/<bShownOnWheel value><\/bShownOnWheel>/g, '<bShownOnWheel value="true"></bShownOnWheel>');
        builtXmlString = builtXmlString.replace(/<CreateObject value\/>/g, '<CreateObject value="true"/>');
        builtXmlString = builtXmlString.replace(/<bShownOnWheel value\/>/g, '<bShownOnWheel value="true"/>');


        const finalWcXmlString = `<?xml version="1.0" encoding="UTF-8"?>\n${builtXmlString}`;
        const wcDestPath = path.join(dataDir, 'weaponcomponents.meta');
        await fs.outputFile(wcDestPath, finalWcXmlString, 'utf-8');
        console.log(`Generated and wrote weaponcomponents.meta to ${wcDestPath}`);

    } catch (wcError) {
        console.error('Error generating weaponcomponents.meta in main.js:', wcError);
    }


    if (importedFilePaths.length > 0) {
      for (const sourceFilePath of importedFilePaths) {
        const fileName = path.basename(sourceFilePath);
        const destFilePath = path.join(streamDir, fileName);
        try {
          await fs.copy(sourceFilePath, destFilePath);
          console.log(`Copied ${sourceFilePath} to ${destFilePath}`);
        } catch (copyError) {
          console.error(`Error copying file ${sourceFilePath} to ${destFilePath}:`, copyError);
        }
      }
    } else {
      console.log('No imported files to copy to stream folder.');
    }

    return { success: true, message: `Successfully exported ${weaponDetails.displayName} to ${rootExportDir}` };

  } catch (error) {
    console.error(`Error during final export process for ${weaponDetails.displayName}:`, error);
    const errorMessage = error.message || 'An unknown error occurred during export.';
    return { success: false, error: `Export failed: ${error.message}` };
  }
});