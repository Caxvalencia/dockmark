"use strict";

const state = {
  rootFolders: [],
  bookmarkTree: [],
  allBookmarks: [],
  folderOptions: [],
  currentSpaceId: null,
  contextNode: null,
  movingNode: null,
  isCreating: false,
  currentSearchQuery: "",
  currentNodes: [],
  currentSpaceTitle: "",
  expandedFolders: new Set(
    JSON.parse(localStorage.getItem("dockmark-expanded-folders") || "[]"),
  ),
  collapsedCollections: new Set(
    JSON.parse(localStorage.getItem("dockmark-collapsed-collections") || "[]"),
  ),
  usageCounts: JSON.parse(localStorage.getItem("dockmark-usage-counts") || "{}"),
};

const DEFAULT_SETTINGS = {
  theme: "system",
  density: "comfortable",
  iconSize: 40,
  minCardWidth: 260,
  accentColor: "#f04e63",
};

const SETTINGS_KEY = "dockmark-settings";
const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
const legacyTheme = localStorage.getItem("dockmark-theme");

const settings = {
  ...DEFAULT_SETTINGS,
  ...(legacyTheme && !savedSettings.theme ? { theme: legacyTheme } : {}),
  ...savedSettings,
};

const elements = {
  sidebarSpaces: document.getElementById("sidebar-spaces"),
  collectionsContainer: document.getElementById("collections-container"),
  currentSpaceTitle: document.getElementById("current-space-title"),
  collectionCount: document.getElementById("collection-count"),
  searchInput: document.getElementById("search-input"),
  searchTypeFilter: document.getElementById("search-type-filter"),
  searchScopeFilter: document.getElementById("search-scope-filter"),
  domainFilter: document.getElementById("domain-filter"),
  contextMenu: document.getElementById("context-menu"),
  cmOpenNew: document.getElementById("cm-open-new"),
  cmCopyUrl: document.getElementById("cm-copy-url"),
  cmMove: document.getElementById("cm-move"),
  cmEdit: document.getElementById("cm-edit"),
  cmDelete: document.getElementById("cm-delete"),
  expandAllBtn: document.getElementById("expand-all-btn"),
  collapseAllBtn: document.getElementById("collapse-all-btn"),
  diagnosticsBtn: document.getElementById("diagnostics-btn"),
  editModal: document.getElementById("edit-modal"),
  editName: document.getElementById("edit-name"),
  editUrl: document.getElementById("edit-url"),
  editUrlGroup: document.getElementById("edit-url-group"),
  modalCancel: document.getElementById("modal-cancel"),
  modalSave: document.getElementById("modal-save"),
  addCollectionBtn: document.getElementById("add-collection-btn"),
  settingsDisclosure: document.getElementById("settings-disclosure"),
  themeSelect: document.getElementById("theme-select"),
  densitySelect: document.getElementById("density-select"),
  iconSizeInput: document.getElementById("icon-size-input"),
  minCardWidthInput: document.getElementById("min-card-width-input"),
  accentColorInput: document.getElementById("accent-color-input"),
  exportConfigBtn: document.getElementById("export-config-btn"),
  importConfigBtn: document.getElementById("import-config-btn"),
  importConfigInput: document.getElementById("import-config-input"),
  moveModal: document.getElementById("move-modal"),
  moveTarget: document.getElementById("move-target"),
  moveCancel: document.getElementById("move-cancel"),
  moveSave: document.getElementById("move-save"),
  diagnosticsModal: document.getElementById("diagnostics-modal"),
  diagnosticsResults: document.getElementById("diagnostics-results"),
  diagnosticsClose: document.getElementById("diagnostics-close"),
  findDuplicatesBtn: document.getElementById("find-duplicates-btn"),
  checkBrokenBtn: document.getElementById("check-broken-btn"),
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  initializeSettings();
  await loadBookmarks();
  setupSearch();
  setupContextMenu();
  setupModal();
  setupMoveModal();
  setupDiagnostics();
  setupConfigImportExport();
  attachBookmarkListeners();
  setupViewControls();
}

function setupViewControls() {
  if (elements.expandAllBtn) {
    elements.expandAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".collection-row").forEach((row) => {
        row.classList.remove("collapsed");
      });
      state.collapsedCollections.clear();
      localStorage.setItem(
        "dockmark-collapsed-collections",
        JSON.stringify([...state.collapsedCollections]),
      );
    });
  }

  if (elements.collapseAllBtn) {
    elements.collapseAllBtn.addEventListener("click", () => {
      document.querySelectorAll(".collection-row").forEach((row) => {
        row.classList.add("collapsed");
        if (row.dataset.id) {
          state.collapsedCollections.add(row.dataset.id);
        }
      });
      localStorage.setItem(
        "dockmark-collapsed-collections",
        JSON.stringify([...state.collapsedCollections]),
      );
    });
  }
}

function initializeSettings() {
  syncSettingsControls();
  applySettings();
  initializeSettingsDisclosure();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);

  elements.themeSelect.addEventListener("change", (event) => {
    settings.theme = event.target.value;
    saveSettings();
  });

  elements.densitySelect.addEventListener("change", (event) => {
    settings.density = event.target.value;
    saveSettings();
  });

  elements.iconSizeInput.addEventListener("input", (event) => {
    settings.iconSize = Number(event.target.value);
    saveSettings();
  });

  elements.minCardWidthInput.addEventListener("input", (event) => {
    settings.minCardWidth = Number(event.target.value);
    saveSettings();
  });

  elements.accentColorInput.addEventListener("input", (event) => {
    settings.accentColor = event.target.value;
    saveSettings();
  });
}

function initializeSettingsDisclosure() {
  const isOpen = localStorage.getItem("dockmark-settings-open") === "true";
  elements.settingsDisclosure.open = isOpen;

  elements.settingsDisclosure.addEventListener("toggle", () => {
    localStorage.setItem(
      "dockmark-settings-open",
      String(elements.settingsDisclosure.open),
    );
  });
}

function syncSettingsControls() {
  elements.themeSelect.value = settings.theme;
  elements.densitySelect.value = settings.density;
  elements.iconSizeInput.value = settings.iconSize;
  elements.minCardWidthInput.value = settings.minCardWidth;
  elements.accentColorInput.value = settings.accentColor;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem("dockmark-theme", settings.theme);
  applySettings();
}

function applySettings() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  document.body.classList.toggle("dark-theme", useDark);
  document.body.classList.remove("density-compact", "density-large");

  if (settings.density === "compact") {
    document.body.classList.add("density-compact");
  }

  if (settings.density === "large") {
    document.body.classList.add("density-large");
  }

  document.documentElement.style.setProperty("--accent-color", settings.accentColor);
  document.body.style.setProperty("--card-min-width", `${settings.minCardWidth}px`);
  document.body.style.setProperty("--card-icon-size", `${settings.iconSize}px`);
  document.body.style.setProperty(
    "--card-favicon-size",
    `${Math.max(18, settings.iconSize - 8)}px`,
  );
}

async function loadBookmarks() {
  try {
    // Get the tree from root
    const tree = await chrome.bookmarks.getTree();
    const rootNodes = tree[0].children || [];
    state.bookmarkTree = rootNodes;

    // Filter out top-level folders to be spaces in the sidebar
    state.rootFolders = rootNodes.filter((node) => !node.url);
    state.allBookmarks = flattenBookmarkTree(rootNodes);
    state.folderOptions = buildFolderOptions(rootNodes);

    renderSidebar();

    // Select the previous space or first space by default
    const savedSpaceId = localStorage.getItem("dockmark-current-space");
    if (savedSpaceId) {
      try {
        const nodes = await chrome.bookmarks.get(savedSpaceId);
        if (nodes && nodes.length > 0) {
          selectSpace(nodes[0]);
        } else if (state.rootFolders.length > 0) {
          selectSpace(state.rootFolders[0]);
        }
      } catch (e) {
        if (state.rootFolders.length > 0) {
          selectSpace(state.rootFolders[0]);
        }
      }
    } else if (state.rootFolders.length > 0) {
      selectSpace(state.rootFolders[0]);
    }
  } catch (error) {
    console.error("Error loading bookmarks:", error);
    elements.collectionsContainer.innerHTML =
      "<p class='empty-state'>Error al cargar los marcadores.</p>";
  }
}

function flattenBookmarkTree(nodes, folderPath = "", folderId = null) {
  let bookmarks = [];

  nodes.forEach((node) => {
    if (node.url) {
      bookmarks.push({
        ...node,
        folderPath: folderPath || "Raíz",
        folderId,
      });
      return;
    }

    const nextPath = folderPath ? `${folderPath} / ${node.title}` : node.title;
    bookmarks.push({
      ...node,
      folderPath,
      folderId: node.id,
    });

    if (node.children) {
      bookmarks = bookmarks.concat(flattenBookmarkTree(node.children, nextPath, node.id));
    }
  });

  return bookmarks;
}

function buildFolderOptions(nodes, path = "") {
  let folders = [];

  nodes.forEach((node) => {
    if (!node.url) {
      const title = path ? `${path} / ${node.title}` : node.title;
      folders.push({ id: node.id, title });

      if (node.children) {
        folders = folders.concat(buildFolderOptions(node.children, title));
      }
    }
  });

  return folders;
}

function saveExpandedState() {
  localStorage.setItem(
    "dockmark-expanded-folders",
    JSON.stringify([...state.expandedFolders]),
  );
}

function renderSidebar() {
  elements.sidebarSpaces.replaceChildren(createTreeList(state.rootFolders));
}

function createTreeList(folders) {
  const ul = document.createElement("ul");
  ul.className = "sidebar-spaces-list";

  folders.forEach((folder) => {
    const li = document.createElement("li");
    li.dataset.id = folder.id;

    if (state.expandedFolders.has(folder.id)) {
      li.classList.add("expanded");
    }

    const container = document.createElement("div");
    container.className = "space-item-container";
    if (state.currentSpaceId === folder.id) {
      container.classList.add("active");
    }

    const hasChildren =
      folder.children && folder.children.some((child) => !child.url);

    const toggleBtn = document.createElement("div");
    toggleBtn.className = "tree-toggle";
    if (hasChildren) {
      toggleBtn.textContent = "▶";
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        li.classList.toggle("expanded");
        if (li.classList.contains("expanded")) {
          state.expandedFolders.add(folder.id);
        } else {
          state.expandedFolders.delete(folder.id);
        }
        saveExpandedState();
      });
    } else {
      toggleBtn.classList.add("empty");
      toggleBtn.textContent = "▶";
    }

    const icon = document.createElement("span");
    icon.className = "space-icon";
    icon.textContent = "📁";

    const title = document.createElement("span");
    title.className = "space-title";
    title.textContent = folder.title;

    container.appendChild(toggleBtn);
    container.appendChild(icon);
    container.appendChild(title);

    container.addEventListener("click", () => selectSpace(folder));
    li.appendChild(container);

    if (hasChildren) {
      const subFolders = folder.children.filter((child) => !child.url);
      li.appendChild(createTreeList(subFolders));
    }

    ul.appendChild(li);
  });

  return ul;
}

async function updateBreadcrumbs(node) {
  const path = [];
  let current = node;

  while (current && current.id !== "0") {
    path.unshift(current);

    if (!current.parentId || current.parentId === "0") {
      break;
    }

    const parentNode = await chrome.bookmarks.get(current.parentId);
    current = parentNode[0];
  }

  elements.currentSpaceTitle.replaceChildren();

  path.forEach((p, index) => {
    const span = document.createElement("span");
    span.textContent = p.title;
    span.className = "breadcrumb-item";
    if (index === path.length - 1) {
      span.classList.add("current");
    }

    if (index < path.length - 1) {
      span.addEventListener("click", () => selectSpace(p));
    }

    elements.currentSpaceTitle.appendChild(span);

    if (index < path.length - 1) {
      const sep = document.createElement("span");
      sep.textContent = "›";
      sep.className = "breadcrumb-separator";
      sep.setAttribute("aria-hidden", "true");
      elements.currentSpaceTitle.appendChild(sep);
    }
  });
}

async function selectSpace(folder) {
  state.currentSpaceId = folder.id;
  localStorage.setItem("dockmark-current-space", folder.id);
  await updateBreadcrumbs(folder);

  // Update active state in sidebar tree
  document.querySelectorAll(".sidebar-spaces-list li").forEach((li) => {
    const container = li.querySelector(".space-item-container");

    if (container) {
      container.classList.toggle("active", li.dataset.id === folder.id);
    }
  });

  // Load collections (subfolders) for this space
  try {
    const [spaceNode] = await chrome.bookmarks.getSubTree(folder.id);
    const children = spaceNode.children || [];

    renderCollections(children, folder.title);
  } catch (error) {
    console.error("Error loading space:", error);
  }
}

function flattenFolders(nodes, path = "") {
  let folders = [];

  nodes.forEach((node) => {
    if (!node.url) {
      const titleParts = path ? [...path, node.title] : [node.title];
      folders.push({
        folder: node,
        title: titleParts.join(" > "),
        titleParts,
        items: node.children || [],
      });

      if (node.children) {
        folders = folders.concat(flattenFolders(node.children, titleParts));
      }
    }
  });

  return folders;
}

function renderCollections(nodes, spaceTitle = "") {
  elements.collectionsContainer.replaceChildren();
  state.currentNodes = nodes;
  state.currentSpaceTitle = spaceTitle;

  renderFrequentRow(nodes);

  // Separar los enlaces directos (sin carpeta)
  const directLinks = nodes.filter((node) => node.url);

  let collectionsCount = 0;

  // Renderizar enlaces directos usando el nombre de la carpeta actual
  if (directLinks.length > 0) {
    const title = spaceTitle ? spaceTitle : "Enlaces directos";
    // Pasamos un objeto mock de folderNode para que soporte drag & drop si fuera necesario
    renderCollectionRow(title, directLinks, { id: state.currentSpaceId });
    collectionsCount++;
  }

  // Aplanar todas las subcarpetas para que cada nivel se vea como una colección
  const allFolders = flattenFolders(nodes);

  allFolders.forEach((f) => {
    // Solo renderizamos los enlaces directos dentro de esta carpeta,
    // porque las subcarpetas ya son sus propias colecciones
    const directItems = f.items.filter((item) => item.url);
    renderCollectionRow(f.title, directItems, f.folder, {
      titleParts: f.titleParts,
    });
    collectionsCount++;
  });

  elements.collectionCount.textContent = `${collectionsCount} colecciones`;

  if (collectionsCount === 0) {
    elements.collectionsContainer.innerHTML =
      "<p class='empty-state'>Esta carpeta está vacía.</p>";
  }
}

function renderFrequentRow(nodes) {
  const idsInSpace = new Set(flattenBookmarkTree(nodes).map((node) => node.id));
  const frequentItems = state.allBookmarks
    .filter((node) => node.url && idsInSpace.has(node.id) && state.usageCounts[node.id])
    .sort((a, b) => (state.usageCounts[b.id] || 0) - (state.usageCounts[a.id] || 0))
    .slice(0, 8);

  if (frequentItems.length > 0) {
    renderCollectionRow("Frecuentes", frequentItems, null, { isSystem: true });
  }
}

function renderCollectionRow(title, items, folderNode = null, options = {}) {
  const row = document.createElement("div");
  row.className = "collection-row";
  if (folderNode && folderNode.id) {
    row.dataset.id = folderNode.id;
    if (state.collapsedCollections.has(folderNode.id)) {
      row.classList.add("collapsed");
    }
  }

  const header = document.createElement("div");
  header.className = "collection-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "collection-header-left";
  headerLeft.style.display = "flex";
  headerLeft.style.alignItems = "center";
  headerLeft.style.cursor = "pointer";

  const toggleBtn = document.createElement("span");
  toggleBtn.className = "collection-toggle";
  toggleBtn.textContent = "▼";

  const titleEl = document.createElement("h2");
  titleEl.className = "collection-title";
  appendCollectionTitle(titleEl, options.titleParts || [title]);
  const countEl = document.createElement("span");
  countEl.className = "collection-size";
  countEl.textContent = `(${items.length})`;
  titleEl.appendChild(countEl);

  headerLeft.appendChild(toggleBtn);
  headerLeft.appendChild(titleEl);
  header.appendChild(headerLeft);

  if (folderNode && folderNode.id !== state.currentSpaceId && !options.isSystem) {
    const editBtn = document.createElement("button");
    editBtn.className = "collection-edit-btn";
    editBtn.textContent = "✏️";
    editBtn.title = "Editar nombre";
    editBtn.addEventListener("click", () => {
      openEditModal(folderNode);
    });
    header.appendChild(editBtn);
  }

  const cardsContainer = document.createElement("div");
  cardsContainer.className = "collection-cards";

  if (items.length === 0) {
    cardsContainer.innerHTML = "<p class='empty-state'>No hay elementos</p>";
  } else {
    items.forEach((item, index) => {
      cardsContainer.appendChild(createCard(item, folderNode, index));
    });
  }

  row.appendChild(header);
  row.appendChild(cardsContainer);
  elements.collectionsContainer.appendChild(row);

  headerLeft.addEventListener("click", () => {
    row.classList.toggle("collapsed");
    const isCollapsed = row.classList.contains("collapsed");
    if (folderNode && folderNode.id) {
      if (isCollapsed) {
        state.collapsedCollections.add(folderNode.id);
      } else {
        state.collapsedCollections.delete(folderNode.id);
      }
      localStorage.setItem(
        "dockmark-collapsed-collections",
        JSON.stringify([...state.collapsedCollections]),
      );
    }
  });

  if (folderNode) {
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", (e) => {
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove("drag-over");
      }
    });

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== folderNode.id) {
        try {
          const draggedNode = await chrome.bookmarks.get(draggedId);
          if (draggedNode[0].parentId !== folderNode.id) {
            await chrome.bookmarks.move(draggedId, { parentId: folderNode.id });
          }
        } catch (err) {
          console.error("Error al mover:", err);
        }
      }
    });
  }
}

function appendCollectionTitle(titleEl, titleParts) {
  titleParts.forEach((part, index) => {
    const partEl = document.createElement("span");
    partEl.className = "collection-title-part";
    partEl.textContent = part;
    titleEl.appendChild(partEl);

    if (index < titleParts.length - 1) {
      const separator = document.createElement("span");
      separator.className = "collection-title-separator";
      separator.textContent = "›";
      separator.setAttribute("aria-hidden", "true");
      titleEl.appendChild(separator);
    }
  });
}

function createCard(node, parentFolder = null, itemIndex = null) {
  const isFolder = !node.url;
  const card = document.createElement(isFolder ? "div" : "a");
  card.className = "bookmark-card";
  card.dataset.id = node.id;
  if (parentFolder && parentFolder.id) {
    card.dataset.parentId = parentFolder.id;
  }
  if (itemIndex !== null) {
    card.dataset.index = String(itemIndex);
  }

  if (!isFolder) {
    card.href = node.url;
    // Open in current tab or new tab depending on preference. Here we just use href.
    card.target = "_self"; // Since it's new tab, replace it
  }

  const header = document.createElement("div");
  header.className = "card-header";

  const iconContainer = document.createElement("div");
  iconContainer.className = "card-icon";

  if (isFolder) {
    iconContainer.textContent = "📁";
  } else {
    // Attempt to get favicon
    try {
      const urlObj = new URL(node.url);
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
      const img = document.createElement("img");
      img.src = faviconUrl;
      img.onerror = () => {
        iconContainer.textContent = "🔗";
      };
      iconContainer.appendChild(img);
    } catch {
      iconContainer.textContent = "🔗";
    }
  }

  const title = document.createElement("div");
  title.className = "card-title";
  setHighlightedText(
    title,
    node.title || (isFolder ? "Carpeta sin nombre" : "Enlace sin nombre"),
    state.currentSearchQuery,
  );

  header.appendChild(iconContainer);
  header.appendChild(title);
  card.appendChild(header);

  if (!isFolder) {
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.appendChild(createQuickAction("↗", "Abrir en pestaña nueva", async () => {
      registerUsage(node.id);
      await chrome.tabs.create({ url: node.url });
    }));
    actions.appendChild(createQuickAction("⧉", "Copiar URL", async () => {
      await copyToClipboard(node.url);
    }));
    actions.appendChild(createQuickAction("⇄", "Mover a colección", () => {
      openMoveModal(node);
    }));
    card.appendChild(actions);

    const urlText = document.createElement("div");
    urlText.className = "card-url";
    try {
      setHighlightedText(urlText, new URL(node.url).hostname, state.currentSearchQuery);
    } catch {
      setHighlightedText(urlText, node.url, state.currentSearchQuery);
    }
    card.appendChild(urlText);
  }

  if (isFolder) {
    card.addEventListener("click", async () => {
      // If a folder is clicked within a collection, navigate into it (replace current view)
      try {
        const [folderNode] = await chrome.bookmarks.getSubTree(node.id);
        const children = folderNode.children || [];
        elements.currentSpaceTitle.textContent = folderNode.title;
        renderCollections(children);
      } catch (e) {
        console.error(e);
      }
    });
  } else {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      registerUsage(node.id);
      chrome.tabs.update({ url: node.url });
    });
  }

  card.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, node, isFolder);
  });

  // Drag and Drop
  card.draggable = true;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => card.classList.add("dragging"), 0);
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
  });

  if (isFolder) {
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent row drop from also firing
      card.classList.remove("drag-over");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== node.id) {
        try {
          await chrome.bookmarks.move(draggedId, { parentId: node.id });
        } catch (err) {
          console.error("Error al mover:", err);
        }
      }
    });
  }

  if (!isFolder) {
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("reorder-target");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("reorder-target");
    });

    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove("reorder-target");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === node.id || !parentFolder) return;

      try {
        const [draggedNode] = await chrome.bookmarks.get(draggedId);
        let targetIndex = Number(card.dataset.index || 0);
        if (draggedNode.parentId === parentFolder.id && draggedNode.index < targetIndex) {
          targetIndex -= 1;
        }
        await chrome.bookmarks.move(draggedId, {
          parentId: parentFolder.id,
          index: targetIndex,
        });
      } catch (err) {
        console.error("Error al reordenar:", err);
      }
    });
  }

  return card;
}

function createQuickAction(label, title, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handler();
  });
  return button;
}

function setHighlightedText(element, text, query) {
  element.replaceChildren();
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    element.textContent = text;
    return;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    element.textContent = text;
    return;
  }

  element.appendChild(document.createTextNode(text.slice(0, matchIndex)));
  const mark = document.createElement("mark");
  mark.className = "highlight";
  mark.textContent = text.slice(matchIndex, matchIndex + normalizedQuery.length);
  element.appendChild(mark);
  element.appendChild(document.createTextNode(text.slice(matchIndex + normalizedQuery.length)));
}

function registerUsage(bookmarkId) {
  state.usageCounts[bookmarkId] = (state.usageCounts[bookmarkId] || 0) + 1;
  localStorage.setItem("dockmark-usage-counts", JSON.stringify(state.usageCounts));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function setupSearch() {
  const runSearch = () => {
    const query = elements.searchInput.value.trim();
    const typeFilter = elements.searchTypeFilter.value;
    const scopeFilter = elements.searchScopeFilter.value;
    const domainFilter = elements.domainFilter.value.trim().toLowerCase();
    state.currentSearchQuery = query;

    if (!query && !domainFilter && typeFilter === "all" && scopeFilter === "all") {
      // Reset view to current space
      const currentSpace = state.rootFolders.find(
        (f) => f.id === state.currentSpaceId,
      );
      if (currentSpace) {
        selectSpace(currentSpace);
      }
      return;
    }

    const lowerQuery = query.toLowerCase();
    const currentIds =
      scopeFilter === "current" ? new Set(flattenBookmarkTree(state.currentNodes).map((n) => n.id)) : null;

    const results = state.allBookmarks.filter((node) => {
      const isFolder = !node.url;
      if (typeFilter === "links" && isFolder) return false;
      if (typeFilter === "folders" && !isFolder) return false;
      if (currentIds && !currentIds.has(node.id)) return false;

      const host = getHostname(node.url || "");
      if (domainFilter && !host.includes(domainFilter)) return false;

      if (!lowerQuery) return true;

      return [node.title, node.url, node.folderPath]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(lowerQuery));
    });

    renderSearchResults(results, query);
  };

  elements.searchInput.addEventListener("input", runSearch);
  elements.searchTypeFilter.addEventListener("change", runSearch);
  elements.searchScopeFilter.addEventListener("change", runSearch);
  elements.domainFilter.addEventListener("input", runSearch);
}

function renderSearchResults(results, query) {
  elements.currentSpaceTitle.textContent = "Resultados de búsqueda";
  elements.collectionsContainer.replaceChildren();

  if (results.length === 0) {
    elements.collectionsContainer.innerHTML =
      "<p class='empty-state'>No se encontraron resultados.</p>";
    elements.collectionCount.textContent = "0 resultados";
    return;
  }

  const groups = new Map();
  results.forEach((node) => {
    const groupTitle = node.folderPath || "Carpetas";
    if (!groups.has(groupTitle)) groups.set(groupTitle, []);
    groups.get(groupTitle).push(node);
  });

  groups.forEach((items, title) => {
    renderCollectionRow(`${title} · resultados`, items);
  });

  elements.collectionCount.textContent = `${results.length} resultados`;
  state.currentSearchQuery = query;
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function attachBookmarkListeners() {
  const updateEvents = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded,
  ];

  updateEvents.forEach((event) => {
    event.addListener(() => {
      // Reload everything to keep it simple
      loadBookmarks();
    });
  });
}

function showContextMenu(x, y, node, isFolder) {
  state.contextNode = node;

  // Posicionar menú
  elements.contextMenu.style.left = `${x}px`;
  elements.contextMenu.style.top = `${y}px`;
  elements.contextMenu.classList.remove("hidden");

  // Ocultar "Abrir en nueva pestaña" si es carpeta
  if (isFolder) {
    elements.cmOpenNew.style.display = "none";
    elements.cmCopyUrl.style.display = "none";
    elements.cmMove.style.display = "none";
  } else {
    elements.cmOpenNew.style.display = "block";
    elements.cmCopyUrl.style.display = "block";
    elements.cmMove.style.display = "block";
  }
}

function setupContextMenu() {
  // Ocultar al hacer clic fuera
  document.addEventListener("click", () => {
    elements.contextMenu.classList.add("hidden");
  });

  elements.cmOpenNew.addEventListener("click", () => {
    if (state.contextNode && state.contextNode.url) {
      registerUsage(state.contextNode.id);
      chrome.tabs.create({ url: state.contextNode.url });
    }
  });

  elements.cmCopyUrl.addEventListener("click", async () => {
    if (state.contextNode && state.contextNode.url) {
      await copyToClipboard(state.contextNode.url);
    }
  });

  elements.cmMove.addEventListener("click", () => {
    if (state.contextNode && state.contextNode.url) {
      openMoveModal(state.contextNode);
    }
  });

  elements.cmEdit.addEventListener("click", () => {
    if (state.contextNode) {
      openEditModal(state.contextNode);
    }
  });

  elements.cmDelete.addEventListener("click", async () => {
    if (state.contextNode) {
      if (
        confirm(`¿Seguro que deseas eliminar "${state.contextNode.title}"?`)
      ) {
        try {
          if (state.contextNode.url) {
            await chrome.bookmarks.remove(state.contextNode.id);
          } else {
            await chrome.bookmarks.removeTree(state.contextNode.id);
          }
        } catch (e) {
          console.error("Error al eliminar", e);
        }
      }
    }
  });
}

function openMoveModal(node) {
  state.movingNode = node;
  elements.moveTarget.replaceChildren();

  state.folderOptions.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.title;
    option.selected = node.parentId === folder.id || node.folderId === folder.id;
    elements.moveTarget.appendChild(option);
  });

  elements.moveModal.classList.remove("hidden");
}

function setupMoveModal() {
  const closeMoveModal = () => {
    elements.moveModal.classList.add("hidden");
    state.movingNode = null;
  };

  elements.moveCancel.addEventListener("click", closeMoveModal);
  elements.moveSave.addEventListener("click", async () => {
    if (!state.movingNode || !elements.moveTarget.value) return;

    try {
      await chrome.bookmarks.move(state.movingNode.id, {
        parentId: elements.moveTarget.value,
      });
      closeMoveModal();
    } catch (error) {
      console.error("Error al mover marcador", error);
      alert("No se pudo mover el marcador.");
    }
  });
}

function openEditModal(node) {
  state.isCreating = false;
  state.contextNode = node;
  document.getElementById("modal-title").textContent = node.url
    ? "Editar Marcador"
    : "Editar Carpeta";
  elements.editName.value = node.title;
  if (node.url) {
    elements.editUrl.value = node.url;
    elements.editUrlGroup.style.display = "block";
  } else {
    elements.editUrl.value = "";
    elements.editUrlGroup.style.display = "none";
  }
  elements.editModal.classList.remove("hidden");
  elements.editName.focus();
}

function setupModal() {
  const closeModal = () => elements.editModal.classList.add("hidden");

  elements.addCollectionBtn.addEventListener("click", () => {
    state.isCreating = true;
    state.contextNode = null;
    document.getElementById("modal-title").textContent = "Nueva Colección";
    elements.editName.value = "";
    elements.editUrl.value = "";
    elements.editUrlGroup.style.display = "none";
    elements.editModal.classList.remove("hidden");
    elements.editName.focus();
  });

  elements.modalCancel.addEventListener("click", closeModal);

  elements.modalSave.addEventListener("click", async () => {
    const newTitle = elements.editName.value.trim();
    const newUrl = elements.editUrl.value.trim();

    if (!newTitle) return;

    try {
      if (state.isCreating) {
        if (state.currentSpaceId) {
          await chrome.bookmarks.create({
            parentId: state.currentSpaceId,
            title: newTitle,
          });
        }
      } else {
        if (!state.contextNode) return;

        const changes = { title: newTitle };
        if (state.contextNode.url) {
          changes.url = newUrl;
        }

        await chrome.bookmarks.update(state.contextNode.id, changes);
      }
      closeModal();
    } catch (e) {
      console.error("Error al actualizar", e);
      alert("Hubo un error al guardar los cambios.");
    }
  });
}

function setupConfigImportExport() {
  elements.exportConfigBtn.addEventListener("click", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      expandedFolders: [...state.expandedFolders],
      collapsedCollections: [...state.collapsedCollections],
      currentSpaceId: state.currentSpaceId,
      usageCounts: state.usageCounts,
      pinned: JSON.parse(localStorage.getItem("dockmark-pinned") || "[]"),
      tags: JSON.parse(localStorage.getItem("dockmark-tags") || "{}"),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dockmark-config.json";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  elements.importConfigBtn.addEventListener("click", () => {
    elements.importConfigInput.click();
  });

  elements.importConfigInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      Object.assign(settings, DEFAULT_SETTINGS, payload.settings || {});
      state.expandedFolders = new Set(payload.expandedFolders || []);
      state.collapsedCollections = new Set(payload.collapsedCollections || []);
      state.usageCounts = payload.usageCounts || {};

      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      localStorage.setItem(
        "dockmark-expanded-folders",
        JSON.stringify([...state.expandedFolders]),
      );
      localStorage.setItem(
        "dockmark-collapsed-collections",
        JSON.stringify([...state.collapsedCollections]),
      );
      localStorage.setItem("dockmark-usage-counts", JSON.stringify(state.usageCounts));

      if (payload.currentSpaceId) {
        localStorage.setItem("dockmark-current-space", payload.currentSpaceId);
      }
      if (payload.pinned) {
        localStorage.setItem("dockmark-pinned", JSON.stringify(payload.pinned));
      }
      if (payload.tags) {
        localStorage.setItem("dockmark-tags", JSON.stringify(payload.tags));
      }

      syncSettingsControls();
      applySettings();
      await loadBookmarks();
    } catch (error) {
      console.error("Error al importar configuración", error);
      alert("El archivo de configuración no es válido.");
    } finally {
      event.target.value = "";
    }
  });
}

function setupDiagnostics() {
  elements.diagnosticsBtn.addEventListener("click", () => {
    elements.diagnosticsResults.innerHTML =
      "<p class='empty-state'>Elige una revisión para empezar.</p>";
    elements.diagnosticsModal.classList.remove("hidden");
  });

  elements.diagnosticsClose.addEventListener("click", () => {
    elements.diagnosticsModal.classList.add("hidden");
  });

  elements.findDuplicatesBtn.addEventListener("click", renderDuplicateDiagnostics);
  elements.checkBrokenBtn.addEventListener("click", checkBrokenLinks);
}

function renderDuplicateDiagnostics() {
  const groups = new Map();
  state.allBookmarks
    .filter((node) => node.url)
    .forEach((node) => {
      const normalizedUrl = normalizeUrl(node.url);
      if (!groups.has(normalizedUrl)) groups.set(normalizedUrl, []);
      groups.get(normalizedUrl).push(node);
    });

  const duplicates = [...groups.entries()].filter(([, items]) => items.length > 1);
  elements.diagnosticsResults.replaceChildren();

  if (duplicates.length === 0) {
    elements.diagnosticsResults.innerHTML =
      "<p class='empty-state'>No se encontraron URLs duplicadas.</p>";
    return;
  }

  duplicates.forEach(([url, items]) => {
    elements.diagnosticsResults.appendChild(
      createDiagnosticsGroup(`${items.length} duplicados · ${url}`, items),
    );
  });
}

async function checkBrokenLinks() {
  const links = state.allBookmarks.filter((node) => node.url).slice(0, 80);
  elements.diagnosticsResults.innerHTML =
    "<p class='empty-state'>Revisando enlaces. Chrome puede bloquear algunos dominios por permisos o CORS.</p>";

  const broken = [];
  for (const link of links) {
    try {
      let response = await fetch(link.url, { method: "HEAD", cache: "no-store" });
      if (response.status === 405) {
        response = await fetch(link.url, { method: "GET", cache: "no-store" });
      }
      if (response.status >= 400) {
        broken.push(link);
      }
    } catch {
      broken.push(link);
    }
  }

  elements.diagnosticsResults.replaceChildren();
  if (broken.length === 0) {
    elements.diagnosticsResults.innerHTML =
      "<p class='empty-state'>No se detectaron enlaces rotos en la muestra revisada.</p>";
    return;
  }

  elements.diagnosticsResults.appendChild(
    createDiagnosticsGroup(`${broken.length} posibles enlaces rotos`, broken),
  );
}

function createDiagnosticsGroup(title, items) {
  const group = document.createElement("div");
  group.className = "diagnostics-group";

  const heading = document.createElement("h4");
  heading.textContent = title;
  group.appendChild(heading);

  const list = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.title || "Sin título"} · ${item.folderPath || "Raíz"}`;
    list.appendChild(li);
  });
  group.appendChild(list);

  return group;
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
