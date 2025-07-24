console.log('Renderer script loaded.');

document.addEventListener('DOMContentLoaded', () => {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const tabId = event.target.dataset.tab;

            tabLinks.forEach(l => l.classList.remove('active'));
            event.target.classList.add('active');

            tabPanes.forEach(pane => {
                if (pane.id === tabId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });

    const initiallyActiveTab = document.querySelector('#main-tabs .tab-link.active');
    if (initiallyActiveTab) {
        const activeTabId = initiallyActiveTab.dataset.tab;
        const activePane = document.getElementById(activeTabId);
        if (activePane) {
            tabPanes.forEach(pane => pane.classList.remove('active'));
            activePane.classList.add('active');
        }
    }

    const createAddonTab = document.getElementById('create-addon');
    if (createAddonTab) {
        const centerContentElement = createAddonTab.querySelector('#center-content');
        const weaponTemplateDropdown = createAddonTab.querySelector('#weapon-template-dropdown');
        const templateDetailsArea = createAddonTab.querySelector('#template-details-area');
        const inputWeaponIdField = createAddonTab.querySelector('#input-weapon-id');
        const inputWeaponModelField = createAddonTab.querySelector('#input-weapon-model');
        const testIpcButton = createAddonTab.querySelector('#test-ipc');
        if (testIpcButton) {
             testIpcButton.addEventListener('click', async () => {
                console.log('Test IPC button clicked - this button is now hidden by default.');
            });
        }

        async function loadTemplatesIntoDropdown() {
            if (!weaponTemplateDropdown) {
                console.error('Weapon template dropdown not found.');
                return;
            }
            try {
                const result = await window.electronAPI.invoke('scan-templates');
                weaponTemplateDropdown.innerHTML = '<option value="">-- Select a Template --</option>';

                if (result.success && result.templates.length > 0) {
                    result.templates.forEach(template => {
                        const option = document.createElement('option');
                        option.value = template.path;
                        option.textContent = template.name;
                        option.dataset.templateName = template.name;
                        weaponTemplateDropdown.appendChild(option);
                    });
                } else if (result.success && result.templates.length === 0) {
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "No templates found";
                    option.disabled = true;
                    weaponTemplateDropdown.appendChild(option);
                } else {
                     const option = document.createElement('option');
                    option.value = "";
                    option.textContent = `Error: ${result.error || 'Unknown'}`;
                    option.disabled = true;
                    weaponTemplateDropdown.appendChild(option);
                }
            } catch (error) {
                weaponTemplateDropdown.innerHTML = `<option value="" disabled>Error loading: ${error.message}</option>`;
            }
        }

        if (weaponTemplateDropdown && templateDetailsArea && centerContentElement) {
            loadTemplatesIntoDropdown();

            weaponTemplateDropdown.addEventListener('change', async (event) => {
                const selectedOption = event.target.selectedOptions[0];
                const templatePath = selectedOption.value;
                const templateName = selectedOption.dataset.templateName;

                if (templatePath && templateName) {
                    centerContentElement.dataset.currentTemplatePath = templatePath;
                    centerContentElement.dataset.currentTemplateName = templateName;

                    if (templateDetailsArea) {
                        templateDetailsArea.innerHTML = '<p class="placeholder-message">Template selected. Asset and XML details are hidden for now as per request.</p>';
                    }

                    window.electronAPI.invoke('get-template-details', templatePath)
                        .then(fullDetailsResult => {
                            if (fullDetailsResult.success && fullDetailsResult.details) {
                                const details = fullDetailsResult.details;

                                const createTabWeaponNameInput = createAddonTab.querySelector('#input-weapon-name');
                                if (createTabWeaponNameInput) createTabWeaponNameInput.value = details.displayName || '';
                                if (inputWeaponIdField) inputWeaponIdField.value = details.weaponId || `WEAPON_${templateName.toUpperCase()}`;
                                if (inputWeaponModelField) inputWeaponModelField.value = details.modelName || '';

                                const configTab = document.getElementById('configuration');
                                if (configTab) {
                                    const audioItemSelect = configTab.querySelector('#config-audio-item');
                                    const weaponDamageInput = configTab.querySelector('#config-weapon-damage');
                                    const weaponRangeInput = configTab.querySelector('#config-weapon-range');
                                    const ammoTypeSelect = configTab.querySelector('#config-ammo-type');
                                    const lodDistanceInput = configTab.querySelector('#config-lod-distance');
                                    const reloadSpeedInput = configTab.querySelector('#config-reload-speed');
                                    const fireRateInput = configTab.querySelector('#config-fire-rate');
                                    const damageTypeSelect = configTab.querySelector('#config-damage-type');
                                    const headshotModifierInput = configTab.querySelector('#config-headshot-modifier');

                                    if (audioItemSelect) audioItemSelect.value = details.audioItem || '';
                                    if (weaponDamageInput) weaponDamageInput.value = details.damage || '';
                                    if (weaponRangeInput) weaponRangeInput.value = details.range || '';
                                    if (ammoTypeSelect) ammoTypeSelect.value = details.ammoTypeRef || '';
                                    if (lodDistanceInput) lodDistanceInput.value = details.lodDistance || '500.0';
                                    if (reloadSpeedInput) reloadSpeedInput.value = details.reloadRate || '';
                                    if (fireRateInput) fireRateInput.value = details.fireRate || '';
                                    if (damageTypeSelect) damageTypeSelect.value = details.damageType || '';
                                    if (headshotModifierInput) headshotModifierInput.value = details.headshotMod || '';
                                }
                            } else {
                                console.error("Failed to fetch full template details for auto-population:", fullDetailsResult.error);
                                if (inputWeaponIdField) inputWeaponIdField.value = `WEAPON_${templateName.toUpperCase()}`;
                                if (inputWeaponModelField) {
                                    let modelSuggestion = "w_";
                                    const parts = templateName.toLowerCase().split('_');
                                    if (parts.length > 1) {
                                        modelSuggestion += parts.slice(1).map(p => p.substring(0, 2)).join('_');
                                        modelSuggestion += `_${parts.slice(1).join('')}`;
                                    } else { modelSuggestion += templateName.toLowerCase(); }
                                    inputWeaponModelField.value = modelSuggestion;
                                }
                            }
                        })
                        .catch(error => {
                            console.error("Error invoking get-template-details:", error);
                            if (inputWeaponIdField) inputWeaponIdField.value = `WEAPON_${templateName.toUpperCase()}`;
                            if (inputWeaponModelField) {
                                let modelSuggestion = "w_";
                                const parts = templateName.toLowerCase().split('_');
                                if (parts.length > 1) {
                                    modelSuggestion += parts.slice(1).map(p => p.substring(0, 2)).join('_');
                                    modelSuggestion += `_${parts.slice(1).join('')}`;
                                } else { modelSuggestion += templateName.toLowerCase(); }
                                inputWeaponModelField.value = modelSuggestion;
                           }
                        });

                } else {
                    if (templateDetailsArea) templateDetailsArea.innerHTML = '<p class="placeholder-message">Select a template from the dropdown to see details and customize assets.</p>';
                    centerContentElement.removeAttribute('data-current-template-path');
                    centerContentElement.removeAttribute('data-current-template-name');

                    const createTabWeaponNameInput = createAddonTab.querySelector('#input-weapon-name');
                    if (createTabWeaponNameInput) createTabWeaponNameInput.value = '';
                    if (inputWeaponIdField) inputWeaponIdField.value = '';
                    if (inputWeaponModelField) inputWeaponModelField.value = '';

                    const configTab = document.getElementById('configuration');
                    if (configTab) {
                        configTab.querySelector('#config-audio-item').value = '';
                        configTab.querySelector('#config-weapon-damage').value = '';
                        configTab.querySelector('#config-weapon-range').value = '';
                        configTab.querySelector('#config-ammo-type').value = '';
                        configTab.querySelector('#config-lod-distance').value = '';
                        configTab.querySelector('#config-reload-speed').value = '';
                        configTab.querySelector('#config-fire-rate').value = '';
                        configTab.querySelector('#config-damage-type').value = '';
                        configTab.querySelector('#config-headshot-modifier').value = '';
                    }
                }
            });
        }
    }
    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    const importedFilesListUL = document.getElementById('imported-files-list');
    let importedFilePaths = [];

    function renderImportedFiles() {
        if (!importedFilesListUL) return;
        importedFilesListUL.innerHTML = '';

        if (importedFilePaths.length === 0) {
            const li = document.createElement('li');
            li.classList.add('no-files-message');
            li.textContent = 'No files imported yet.';
            importedFilesListUL.appendChild(li);
        } else {
            importedFilePaths.forEach((filePath, index) => {
                const li = document.createElement('li');
                li.textContent = path.basename(filePath);

                const removeBtn = document.createElement('button');
                removeBtn.classList.add('remove-file-btn');
                removeBtn.textContent = 'X';
                removeBtn.title = `Remove ${path.basename(filePath)}`;
                removeBtn.addEventListener('click', () => {
                    importedFilePaths.splice(index, 1);
                    renderImportedFiles();
                    updateAssetPlaceholdersAfterRemoval(filePath);
                });

                li.appendChild(removeBtn);
                importedFilesListUL.appendChild(li);
            });
        }
    }

    if(importedFilesListUL) renderImportedFiles();

    function updateAssetPlaceholdersAfterRemoval(removedFilePath) {
        const ydrFileNameP = document.getElementById('ydr-file-name');
        const ytdFileNameP = document.getElementById('ytd-file-name');
        const baseName = path.basename(removedFilePath);

        if (ydrFileNameP && ydrFileNameP.textContent === baseName) {
            ydrFileNameP.textContent = 'default_model.ydr';
        }
        if (ytdFileNameP && ytdFileNameP.textContent === baseName) {
            ytdFileNameP.textContent = 'default_texture.ytd';
        }
    }
    const path_renderer = {
        basename: (p) => p.split(/[\\/]/).pop()
    };

    function correctedRenderImportedFiles() {
        if (!importedFilesListUL) return;
        importedFilesListUL.innerHTML = '';

        const weaponModelInput = document.getElementById('input-weapon-model');
        const modelName = weaponModelInput ? weaponModelInput.value.trim().toLowerCase() : "";

        if (importedFilePaths.length === 0) {
            const li = document.createElement('li');
            li.classList.add('no-files-message');
            li.textContent = 'No files imported yet.';
            importedFilesListUL.appendChild(li);
        } else {
            importedFilePaths.forEach((filePath, index) => {
                const li = document.createElement('li');
                const baseFilename = path_renderer.basename(filePath).toLowerCase();
                li.textContent = path_renderer.basename(filePath);

                li.classList.remove('file-state-initial', 'file-state-core', 'file-state-addon');

                if (!modelName) {
                    li.classList.add('file-state-initial');
                } else {
                    const isCoreYdr = baseFilename === `${modelName}.ydr`;
                    const isCoreYtd = baseFilename === `${modelName}.ytd`;
                    const isCoreHiYdr = baseFilename === `${modelName}_hi.ydr`;

                    if (isCoreYdr || isCoreYtd || isCoreHiYdr) {
                        li.classList.add('file-state-core');
                    } else {
                        const modelNameIsSpecific = modelName.length >= 6 && modelName.includes('_');
                        if (modelNameIsSpecific && (baseFilename.endsWith('.ydr') || baseFilename.endsWith('.ytd'))) {
                            li.classList.add('file-state-addon');
                        } else {
                            li.classList.add('file-state-initial');
                        }
                    }
                }

                const removeBtn = document.createElement('button');
                removeBtn.classList.add('remove-file-btn');
                removeBtn.textContent = 'X';
                removeBtn.title = `Remove ${path_renderer.basename(filePath)}`;
                removeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    importedFilePaths.splice(index, 1);
                    correctedRenderImportedFiles();
                });

                li.appendChild(removeBtn);
                importedFilesListUL.appendChild(li);
            });
        }
    }
    if(importedFilesListUL) correctedRenderImportedFiles();
    function correctedUpdateAssetPlaceholdersAfterRemoval(removedFilePath) {
        const ydrFileNameP = document.getElementById('ydr-file-name');
        const ytdFileNameP = document.getElementById('ytd-file-name');
        const baseName = path_renderer.basename(removedFilePath);

        if (ydrFileNameP && ydrFileNameP.textContent === baseName) {
            ydrFileNameP.textContent = 'default_model.ydr';
        }
        if (ytdFileNameP && ytdFileNameP.textContent === baseName) {
            ytdFileNameP.textContent = 'default_texture.ytd';
        }
    }

    const weaponModelNameInput = document.getElementById('input-weapon-model');
    if (weaponModelNameInput) {
        weaponModelNameInput.addEventListener('input', () => {
            correctedRenderImportedFiles();
        });
    } else {
        console.warn('#input-weapon-model field not found for attaching event listener.');
    }

    window.addImportedFileToList = function(filePath) {
       if (!importedFilePaths.find(f => f === filePath)) {
           importedFilePaths.push(filePath);
           correctedRenderImportedFiles();
       }
    }

    const browseDirBtn = document.getElementById('browse-dir-btn');
    const dirPathSpan = document.querySelector('#bottom-bar-directory span');

    if (browseDirBtn && dirPathSpan) {
        browseDirBtn.addEventListener('click', async () => {
            dirPathSpan.textContent = 'Directory where files were found: Browsing...';
            try {
                const result = await window.electronAPI.invoke('open-folder-dialog');
                if (result.success && result.path) {
                    const selectedFolderPath = result.path;
                    dirPathSpan.textContent = `Directory where files were found: ${selectedFolderPath}`;
                    console.log(`Selected asset directory: ${selectedFolderPath}`);

                    try {
                        const scanResult = await window.electronAPI.invoke('scan-directory-for-assets', selectedFolderPath);
                        if (scanResult.success) {
                            importedFilePaths = [];
                            if (scanResult.files && scanResult.files.length > 0) {
                                scanResult.files.forEach(filePath => {
                                    if (window.addImportedFileToList) {
                                        window.addImportedFileToList(filePath);
                                    } else {
                                        console.error('addImportedFileToList function is not defined on window.');
                                    }
                                });
                            } else {
                                if (typeof correctedRenderImportedFiles === 'function') {
                                    correctedRenderImportedFiles();
                                } else {
                                    console.error('correctedRenderImportedFiles function is not defined.');
                                }
                            }
                        } else {
                            console.error('Failed to scan directory for assets:', scanResult.error);
                            importedFilePaths = [];
                            if (typeof correctedRenderImportedFiles === 'function') {
                                correctedRenderImportedFiles();
                            }
                            dirPathSpan.textContent = `Error scanning directory: ${scanResult.error || 'Unknown error'}`;
                        }
                    } catch (scanError) {
                        console.error('Error invoking scan-directory-for-assets:', scanError);
                        importedFilePaths = [];
                        if (typeof correctedRenderImportedFiles === 'function') {
                            correctedRenderImportedFiles();
                        }
                        dirPathSpan.textContent = `Error scanning: ${scanError.message}`;
                    }

                } else {
                    dirPathSpan.textContent = `Directory where files were found: ${result.message || 'No folder selected.'}`;
                    importedFilePaths = [];
                    if (typeof correctedRenderImportedFiles === 'function') {
                        correctedRenderImportedFiles();
                    }
                }
            } catch (error) {
                console.error('Error opening folder dialog via IPC:', error);
                dirPathSpan.textContent = `Directory where files were found: Error - ${error.message}`;
                importedFilePaths = [];
                if (typeof correctedRenderImportedFiles === 'function') {
                    correctedRenderImportedFiles();
                }
            }
        });
    } else {
        console.warn("Bottom bar browse button or path display span not found.");
    }
    async function populateConfigDropdowns() {
        const configTab = document.getElementById('configuration');
        if (!configTab) {
            console.warn("Configuration tab not found, cannot populate dropdowns.");
            return;
        }

        const audioItemSelect = configTab?.querySelector('#config-audio-item');
        const ammoTypeSelect = configTab?.querySelector('#config-ammo-type');
        const damageTypeSelect = configTab.querySelector('#config-damage-type');

        const compAmmoInfoSelect = document.querySelector('#components #comp-ammo-info');


        try {
            const result = await window.electronAPI.invoke('get-config-dropdown-options');
            if (result.success && result.options) {
                const { audioItems, ammoTypes, damageTypes, ammoEffects } = result.options;

                function populateSelect(selectElement, items, defaultLabel) {
                    if (!selectElement) return;
                    selectElement.innerHTML = `<option value="">-- ${defaultLabel} --</option>`;
                    if (items && Array.isArray(items)) {
                        items.forEach(item => {
                            const option = document.createElement('option');
                            option.value = item.value;
                            option.textContent = item.label;
                            selectElement.appendChild(option);
                        });
                    }
                }

                populateSelect(audioItemSelect, audioItems, 'Select Audio');
                populateSelect(ammoTypeSelect, ammoTypes, 'Select Ammo Type');
                populateSelect(damageTypeSelect, damageTypes, 'Select Damage Type');
                populateSelect(compAmmoInfoSelect, ammoEffects, 'Select Ammo Effect');

                console.log("Configuration and Component dropdowns populated.");
            } else {
                console.error("Failed to get config dropdown options:", result.error);
            }
        } catch (error) {
            console.error("Error invoking 'get-config-dropdown-options':", error);
        }
    }

    populateConfigDropdowns();

    const exportTab = document.getElementById('export');
    if (exportTab) {
        const browseExportFolderBtn = exportTab.querySelector('#browse-export-folder-btn');
        const exportFolderPathDisplay = exportTab.querySelector('#export-folder-path-display');
        const finalExportBtn = exportTab.querySelector('#final-export-btn');
        const exportStatusMessages = exportTab.querySelector('#export-status-messages');
        let currentExportPath = '';

        if (browseExportFolderBtn && exportFolderPathDisplay) {
            browseExportFolderBtn.addEventListener('click', async () => {
                exportFolderPathDisplay.value = 'Browsing...';
                exportStatusMessages.textContent = '';
                try {
                    const result = await window.electronAPI.invoke('open-folder-dialog');
                    if (result.success && result.path) {
                        currentExportPath = result.path;
                        exportFolderPathDisplay.value = currentExportPath;
                    } else {
                        exportFolderPathDisplay.value = currentExportPath || 'No folder selected...';
                        if (result.message) {
                             exportStatusMessages.textContent = result.message;
                             exportStatusMessages.className = 'status-message error';
                        }
                    }
                } catch (error) {
                    console.error('Error opening folder dialog for export:', error);
                    exportFolderPathDisplay.value = 'Error selecting folder.';
                    exportStatusMessages.textContent = `Error: ${error.message}`;
                    exportStatusMessages.className = 'status-message error';
                }
            });
        }

        if (finalExportBtn) {
            finalExportBtn.addEventListener('click', async () => {
                exportStatusMessages.textContent = 'Gathering data for export...';
                exportStatusMessages.className = 'status-message';

                const createAddonCenterContent = document.querySelector('#create-addon #center-content');
                const selectedTemplatePath = createAddonCenterContent?.dataset.currentTemplatePath;
                const selectedTemplateName = createAddonCenterContent?.dataset.currentTemplateName;
                const inputWeaponName = createAddonCenterContent?.querySelector('#input-weapon-name')?.value.trim();
                const inputWeaponId = createAddonCenterContent?.querySelector('#input-weapon-id')?.value.trim().toUpperCase();
                const inputWeaponModel = createAddonCenterContent?.querySelector('#input-weapon-model')?.value.trim();
                const ydrFileName = "default_model.ydr";
                const ytdFileName = "default_texture.ytd";

                const configTab = document.getElementById('configuration');
                const configurations = {};
                if (configTab) {
                    configurations.audioItem = configTab.querySelector('#config-audio-item')?.value;
                    configurations.weaponDamage = configTab.querySelector('#config-weapon-damage')?.value;
                    configurations.weaponRange = configTab.querySelector('#config-weapon-range')?.value;
                    configurations.ammoType = configTab.querySelector('#config-ammo-type')?.value;
                    configurations.lodDistance = configTab.querySelector('#config-lod-distance')?.value;
                    configurations.reloadSpeed = configTab.querySelector('#config-reload-speed')?.value;
                    configurations.fireRate = configTab.querySelector('#config-fire-rate')?.value;
                    configurations.damageType = configTab.querySelector('#config-damage-type')?.value;
                    configurations.headshotModifier = configTab.querySelector('#config-headshot-modifier')?.value;
                }

                const components = window.getCurrentComponents ? window.getCurrentComponents() : [];

                for (const component of components) {
                    if (component.hasClipSizeTag && (!component.clipSize || component.clipSize.toUpperCase() === "N/A")) {
                        exportStatusMessages.textContent = `Error: Component "${component.name}" requires a valid Clip Size. Please update it in the Components tab.`;
                        exportStatusMessages.className = 'status-message error';
                        return;
                    }
                }

                let archetypeMetaContent = null;
                let archetypeMetaRelativePath = null;

                if (inputWeaponModel && configurations.lodDistance && inputWeaponId) {
                    const archetypeWeaponData = {
                        weaponName: inputWeaponId,
                        modelName: inputWeaponModel,
                        lodDist: configurations.lodDistance,
                        components: components.map(c => ({
                            modelName: c.modelName,
                            lodDist: c.modelLod
                        })).filter(c => c.modelName && c.modelLod)
                    };
                    const archetypeResult = await generateWeaponArchetypeMeta(archetypeWeaponData, currentExportPath);
                    if (archetypeResult.success) {
                        archetypeMetaContent = archetypeResult.content;
                        if (currentExportPath && archetypeResult.filePath.startsWith(currentExportPath)) {
                            let relPath = archetypeResult.filePath.substring(currentExportPath.length);
                            if (relPath.startsWith('/') || relPath.startsWith('\\')) {
                                relPath = relPath.substring(1);
                            }
                            archetypeMetaRelativePath = relPath;
                        } else {
                             archetypeMetaRelativePath = `${inputWeaponId}/weaponarchetypes.meta`;
                        }
                    } else {
                        exportStatusMessages.textContent = `Error generating weaponarchetypes.meta: ${archetypeResult.error}`;
                        exportStatusMessages.className = 'status-message error';
                        return;
                    }
                } else {
                    exportStatusMessages.textContent = 'Error: Missing Model Name, LOD Distance, or Weapon ID for weaponarchetypes.meta.';
                    exportStatusMessages.className = 'status-message error';
                    return;
                }


                if (!currentExportPath) {
                    exportStatusMessages.textContent = 'Error: Please select an export folder.';
                    exportStatusMessages.className = 'status-message error';
                    return;
                }
                if (!inputWeaponName) {
                    exportStatusMessages.textContent = 'Error: Weapon Name (Display Name) is required for the export folder name.';
                    exportStatusMessages.className = 'status-message error';
                    return;
                }
                if (!inputWeaponId) {
                    exportStatusMessages.textContent = 'Error: Weapon ID is required (from Create Addon Weapon tab).';
                    exportStatusMessages.className = 'status-message error';
                    return;
                }
                if (!selectedTemplatePath) {
                    exportStatusMessages.textContent = 'Error: No base weapon template selected (from Create Addon Weapon tab).';
                    exportStatusMessages.className = 'status-message error';
                    return;
                }

                const exportData = {
                    exportPath: currentExportPath,
                    weaponDetails: {
                        baseTemplatePath: selectedTemplatePath,
                        baseTemplateName: selectedTemplateName,
                        weaponId: inputWeaponId,
                        displayName: inputWeaponName,
                        modelName: inputWeaponModel,
                        ydrFile: ydrFileName,
                        ytdFile: ytdFileName 
                    },
                    configurations,
                    components,
                    importedFilePaths: [...importedFilePaths],
                    metaFiles: {}
                };

                if (archetypeMetaContent && archetypeMetaRelativePath) {
                    exportData.metaFiles['weaponarchetypes'] = {
                        relativePath: archetypeMetaRelativePath,
                        content: archetypeMetaContent
                    };
                }

                console.log("--- Data Gathered for Export ---");
                console.log(JSON.stringify(exportData, null, 2));
                exportStatusMessages.textContent = "Preparing to export...";
                exportStatusMessages.className = 'status-message';


                try {
                    const result = await window.electronAPI.invoke('perform-final-export', exportData);
                    if (result.success) {
                        exportStatusMessages.textContent = `Export successful: ${result.message || 'Files processed.'}`;
                        exportStatusMessages.className = 'status-message success';
                    } else {
                        exportStatusMessages.textContent = `Export failed: ${result.error || 'Unknown error during export.'}`;
                        exportStatusMessages.className = 'status-message error';
                    }
                } catch (ipcError) {
                    console.error('IPC Error during final export:', ipcError);
                    exportStatusMessages.textContent = `Export IPC error: ${ipcError.message}`;
                    exportStatusMessages.className = 'status-message error';
                }
            });
        }
    }
    const componentsTab = document.getElementById('components');
    if (componentsTab) {
        const addedComponentsListUL = componentsTab.querySelector('#added-components-list');
        const addNewComponentBtn = componentsTab.querySelector('#add-new-component-btn');
        const removeSelectedComponentBtn = componentsTab.querySelector('#remove-selected-component-btn');

        const compSelectTemplateDropdown = componentsTab.querySelector('#comp-select-template');
        const compNameInput = componentsTab.querySelector('#comp-name');
        const compModelNameInput = componentsTab.querySelector('#comp-model-name');
        const compModelLodInput = componentsTab.querySelector('#comp-model-lod');
        const compClipSizeInput = componentsTab.querySelector('#comp-clip-size');
        const compAmmoInfoSelect = componentsTab.querySelector('#comp-ammo-info');
        const compEnabledCheckbox = componentsTab.querySelector('#comp-enabled');

        let currentComponents = [];
        let selectedComponentIndex = -1;

        function renderAddedComponents() {
            if (!addedComponentsListUL) return;
            addedComponentsListUL.innerHTML = '';

            if (currentComponents.length === 0) {
                const li = document.createElement('li');
                li.classList.add('no-components-message');
                li.textContent = 'No components added yet.';
                addedComponentsListUL.appendChild(li);
                removeSelectedComponentBtn.disabled = true;
            } else {
                currentComponents.forEach((component, index) => {
                    const li = document.createElement('li');
                    li.textContent = component.name || `Component ${index + 1}`;
                    li.dataset.index = index;
                    if (index === selectedComponentIndex) {
                        li.classList.add('selected');
                    }
                    li.addEventListener('click', () => {
                        if (selectedComponentIndex !== -1 && selectedComponentIndex !== index) {
                            saveCurrentComponentFormState();
                        }
                        selectedComponentIndex = index;
                        renderAddedComponents();
                        populateComponentEditor(currentComponents[index]);
                        removeSelectedComponentBtn.disabled = false;
                    });
                    addedComponentsListUL.appendChild(li);
                });
                if (selectedComponentIndex === -1) {
                    removeSelectedComponentBtn.disabled = true;
                }
            }
        }

        function clearComponentEditor() {
            if (compSelectTemplateDropdown) compSelectTemplateDropdown.value = '';
            if (compNameInput) compNameInput.value = '';
            if (compModelNameInput) compModelNameInput.value = '';
            if (compModelLodInput) compModelLodInput.value = '500.0';
            if (compClipSizeInput) compClipSizeInput.value = '';
            if (compAmmoInfoSelect) compAmmoInfoSelect.value = '';
            if (compEnabledCheckbox) compEnabledCheckbox.checked = true;
        }

        function populateComponentEditor(component) {
            if (!component) {
                clearComponentEditor();
                return;
            }

            if (compSelectTemplateDropdown) {
                compSelectTemplateDropdown.value = component.templatePath || "";
            }

            if (compNameInput) compNameInput.value = component.name || '';
            if (compModelNameInput) compModelNameInput.value = component.modelName || '';

            if (compModelLodInput) {
                compModelLodInput.value = (component.modelLod !== undefined && component.modelLod !== null && component.modelLod !== "") ? component.modelLod : '500.0';
            }

            if (compClipSizeInput) {
                compClipSizeInput.value = (component.clipSize === null || component.clipSize === undefined || component.clipSize === "") ? 'N/A' : component.clipSize;
            }

            if (compAmmoInfoSelect) {
                const ammoInfoValue = component.ammoInfo ?? "";
                if (ammoInfoValue === "") {
                    compAmmoInfoSelect.selectedIndex = 0;
                } else {
                    compAmmoInfoSelect.value = ammoInfoValue;
                }
            }
            if (compEnabledCheckbox) {
                compEnabledCheckbox.checked = component.enabled !== undefined ? component.enabled : true;
            }
        }

        if (addNewComponentBtn) {
            addNewComponentBtn.addEventListener('click', () => {
                saveCurrentComponentFormState();

                const newComponentName = compNameInput?.value.trim() || `Untitled Component ${currentComponents.length + 1}`;

                const newComponent = {
                    name: newComponentName,
                    templatePath: compSelectTemplateDropdown?.value,
                    modelName: compModelNameInput?.value.trim(),
                    modelLod: compModelLodInput?.value.trim() || '500.0',
                    clipSize: compClipSizeInput?.value.trim(),
                    ammoInfo: compAmmoInfoSelect?.value ?? "",
                    enabled: compEnabledCheckbox?.checked,
                    hasClipSizeTag: false
                };
                if (newComponent.templatePath) {
                    window.electronAPI.invoke('get-component-template-details', newComponent.templatePath)
                        .then(result => {
                            if (result.success && result.details) {
                                newComponent.hasClipSizeTag = result.details.hasClipSizeTag || false;
                            }
                        })
                        .catch(err => console.error("Error fetching template details for new component's hasClipSizeTag:", err));
                }


                currentComponents.push(newComponent);
                selectedComponentIndex = currentComponents.length - 1;

                renderAddedComponents();
                removeSelectedComponentBtn.disabled = false;
            });
        }

        if (removeSelectedComponentBtn) {
            removeSelectedComponentBtn.addEventListener('click', () => {
                if (selectedComponentIndex > -1 && selectedComponentIndex < currentComponents.length) {
                    currentComponents.splice(selectedComponentIndex, 1);
                    selectedComponentIndex = -1;
                    clearComponentEditor();
                    renderAddedComponents();
                    removeSelectedComponentBtn.disabled = true;
                }
            });
        }

        renderAddedComponents();


        function saveCurrentComponentFormState() {
            if (selectedComponentIndex > -1 && selectedComponentIndex < currentComponents.length) {
                const component = currentComponents[selectedComponentIndex];
                if (!component) return;

                component.name = compNameInput?.value.trim() || `Component ${selectedComponentIndex + 1}`;
                component.templatePath = compSelectTemplateDropdown?.value;
                component.modelName = compModelNameInput?.value.trim();
                component.modelLod = compModelLodInput?.value.trim();
                let clipSizeVal = compClipSizeInput?.value.trim();
                component.clipSize = (clipSizeVal === "N/A" || clipSizeVal === "") ? null : clipSizeVal;
                component.ammoInfo = compAmmoInfoSelect?.value ?? "";
                component.enabled = compEnabledCheckbox?.checked;

                const listItem = addedComponentsListUL.querySelector(`li[data-index="${selectedComponentIndex}"]`);
                if (listItem) {
                }
            }
        }

        window.getCurrentComponents = () => {
            saveCurrentComponentFormState();
            return JSON.parse(JSON.stringify(currentComponents));
        };
        const componentFormFields = [
            compNameInput, compSelectTemplateDropdown, compModelNameInput,
            compModelLodInput, compClipSizeInput, compAmmoInfoSelect, compEnabledCheckbox
        ];

        componentFormFields.forEach(field => {
            if (field) {
                const eventType = (field.tagName === 'SELECT' || field.type === 'checkbox') ? 'change' : 'input';
                field.addEventListener(eventType, () => {
                    saveCurrentComponentFormState();
                    if (field === compNameInput) {
                        renderAddedComponents();
                    }
                    if (field === compSelectTemplateDropdown && selectedComponentIndex !== -1) {
                        const currentComponent = currentComponents[selectedComponentIndex];
                        if (currentComponent && currentComponent.templatePath) {
                             window.electronAPI.invoke('get-component-template-details', currentComponent.templatePath)
                                .then(result => {
                                    if (result.success && result.details) {
                                        currentComponent.hasClipSizeTag = result.details.hasClipSizeTag || false;
                                        console.log(`Updated hasClipSizeTag for ${currentComponent.name} to ${currentComponent.hasClipSizeTag}`);
                                    }
                                })
                                .catch(err => console.error("Error updating hasClipSizeTag on template change:", err));
                        } else if (currentComponent) {
                            currentComponent.hasClipSizeTag = false;
                        }
                    }
                });
            }
        });

        async function loadComponentTemplatesDropdown() {
            if (!compSelectTemplateDropdown) {
                console.error("Component template dropdown not found.");
                return;
            }
            try {
                const result = await window.electronAPI.invoke('scan-component-templates');
                compSelectTemplateDropdown.innerHTML = '<option value="">-- Select Template --</option>';
                if (result.success && result.templates.length > 0) {
                    result.templates.forEach(template => {
                        const option = document.createElement('option');
                        option.value = template.path;
                        option.textContent = template.name;
                        option.dataset.templateName = template.name;
                        compSelectTemplateDropdown.appendChild(option);
                    });
                } else if (result.success && result.templates.length === 0) {
                    compSelectTemplateDropdown.innerHTML = '<option value="" disabled>No component templates found</option>';
                } else {
                    compSelectTemplateDropdown.innerHTML = `<option value="" disabled>Error: ${result.error || 'Unknown'}</option>`;
                }
            } catch (error) {
                console.error("Error loading component templates:", error);
                compSelectTemplateDropdown.innerHTML = `<option value="" disabled>Error: ${error.message}</option>`;
            }
        }

        if (compSelectTemplateDropdown) {
            loadComponentTemplatesDropdown();

            compSelectTemplateDropdown.addEventListener('change', async (event) => {
                const selectedOption = event.target.selectedOptions[0];
                const templatePath = selectedOption.value;

                if (templatePath) {
                    try {
                        const result = await window.electronAPI.invoke('get-component-template-details', templatePath);
                        if (result.success && result.details) {
                            const details = result.details;
                            if (compNameInput) compNameInput.value = details.componentName || '';
                            if (compModelNameInput) compModelNameInput.value = details.modelName || '';
                            if (compModelLodInput) compModelLodInput.value = '500.0';
                            if (compClipSizeInput) compClipSizeInput.value = details.clipSize ?? 'N/A';
                            if (compAmmoInfoSelect) {
                                compAmmoInfoSelect.value = details.ammoInfoRef || "";
                            }
                            if (selectedComponentIndex !== -1 && currentComponents[selectedComponentIndex]) {
                                currentComponents[selectedComponentIndex].hasClipSizeTag = details.hasClipSizeTag || false;
                                currentComponents[selectedComponentIndex].templatePath = templatePath;
                                console.log(`Updated hasClipSizeTag for ${currentComponents[selectedComponentIndex].name} to ${currentComponents[selectedComponentIndex].hasClipSizeTag} via dropdown change.`);
                            }
                        } else {
                            console.error("Failed to fetch component template details:", result.error);
                            clearComponentEditor();
                            if (compModelLodInput) compModelLodInput.value = '500.0';
                             if (selectedComponentIndex !== -1 && currentComponents[selectedComponentIndex]) {
                                currentComponents[selectedComponentIndex].hasClipSizeTag = false;
                            }
                        }
                    } catch (ipcError) {
                        console.error("IPC Error fetching component template details:", ipcError);
                        clearComponentEditor();
                        if (compModelLodInput) compModelLodInput.value = '500.0';
                        if (selectedComponentIndex !== -1 && currentComponents[selectedComponentIndex]) {
                            currentComponents[selectedComponentIndex].hasClipSizeTag = false;
                        }
                    }
                } else {
                    clearComponentEditor();
                    if (compModelLodInput) compModelLodInput.value = '500.0';
                    if (selectedComponentIndex !== -1 && currentComponents[selectedComponentIndex]) {
                        currentComponents[selectedComponentIndex].hasClipSizeTag = false;
                        currentComponents[selectedComponentIndex].templatePath = "";
                    }
                }
            });
        }

    }


    async function generateWeaponArchetypeMeta(weaponData, exportPath) {

        if (!weaponData || !weaponData.modelName || !weaponData.weaponName || !weaponData.lodDist) {
            console.error('generateWeaponArchetypeMeta: Invalid weaponData provided (missing modelName, weaponName, or lodDist for base weapon).', weaponData);
            return { success: false, error: 'Invalid weaponData for archetype generation (missing modelName, weaponName, or lodDist for base weapon).' };
        }

        let itemsXml = '';

        if (weaponData.components && Array.isArray(weaponData.components)) {
            weaponData.components.forEach(comp => {
                if (comp.modelName && comp.lodDist) {
                    itemsXml += `
        <Item>
            <modelName>${comp.modelName}</modelName>
            <txdName>${comp.modelName}</txdName>
            <ptfxAssetName>NULL</ptfxAssetName>
            <lodDist value="${comp.lodDist}"/>
        </Item>`;
                }
            });
        }

        itemsXml += `
        <Item>
            <modelName>${weaponData.modelName}</modelName>
            <txdName>${weaponData.modelName}</txdName>
            <ptfxAssetName>NULL</ptfxAssetName>
            <lodDist value="${weaponData.lodDist}"/>
        </Item>`;

        const fullXml = `<?xml version="1.0" encoding="UTF-8"?>
<CWeaponModelInfo__InitDataList>
    <InitDatas>${itemsXml}
    </InitDatas>
</CWeaponModelInfo__InitDataList>
`;
        const weaponSpecificFolderPath = `${exportPath}/${weaponData.weaponName}`;
        const filePath = `${weaponSpecificFolderPath}/weaponarchetypes.meta`;

        try {

            console.log(`Generated XML for weaponarchetypes.meta for ${weaponData.weaponName}`);

            return { success: true, filePath: filePath, content: fullXml.trim() };

        } catch (error) {
            console.error(`Error preparing weaponarchetypes.meta for ${weaponData.weaponName}:`, error);
            return { success: false, error: error.message };
        }
    }


    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            if (document.body.classList.contains('dark-mode')) {
                themeToggleBtn.textContent = "Switch to Light Mode";
            } else {
                themeToggleBtn.textContent = "Switch to Dark Mode";
            }
        });

        if (document.body.classList.contains('dark-mode')) {
            themeToggleBtn.textContent = "Switch to Light Mode";
        } else {
            themeToggleBtn.textContent = "Switch to Dark Mode";
        }

    } else {
        console.warn("Theme toggle button not found.");
    }

});
