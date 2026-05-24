"use strict";

const state = {
  rootFolders: [],
  currentSpaceId: null,
  contextNode: null,
  isCreating: false,
  expandedFolders: new Set(
    JSON.parse(localStorage.getItem("dockmark-expanded-folders") || "[]"),
  ),
  collapsedCollections: new Set(
    JSON.parse(localStorage.getItem("dockmark-collapsed-collections") || "[]"),
  ),
};

const elements = {
  sidebarSpaces: document.getElementById("sidebar-spaces"),
  collectionsContainer: document.getElementById("collections-container"),
  currentSpaceTitle: document.getElementById("current-space-title"),
  collectionCount: document.getElementById("collection-count"),
  searchInput: document.getElementById("search-input"),
  contextMenu: document.getElementById("context-menu"),
  cmOpenNew: document.getElementById("cm-open-new"),
  cmEdit: document.getElementById("cm-edit"),
  cmDelete: document.getElementById("cm-delete"),
  expandAllBtn: document.getElementById("expand-all-btn"),
  collapseAllBtn: document.getElementById("collapse-all-btn"),
  editModal: document.getElementById("edit-modal"),
  editName: document.getElementById("edit-name"),
  editUrl: document.getElementById("edit-url"),
  editUrlGroup: document.getElementById("edit-url-group"),
  modalCancel: document.getElementById("modal-cancel"),
  modalSave: document.getElementById("modal-save"),
  addCollectionBtn: document.getElementById("add-collection-btn"),
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  initializeTheme();
  await loadBookmarks();
  setupSearch();
  setupContextMenu();
  setupModal();
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

function initializeTheme() {
  const savedTheme = localStorage.getItem("dockmark-theme") || "light";

  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
  }

  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      const isDark = document.body.classList.contains("dark-theme");
      localStorage.setItem("dockmark-theme", isDark ? "dark" : "light");
    });
  }
}

async function loadBookmarks() {
  try {
    // Get the tree from root
    const tree = await chrome.bookmarks.getTree();
    const rootNodes = tree[0].children || [];

    // Filter out top-level folders to be spaces in the sidebar
    state.rootFolders = rootNodes.filter((node) => !node.url);

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

    if (index < path.length - 1) {
      span.style.cursor = "pointer";
      span.addEventListener("click", () => selectSpace(p));
    }

    elements.currentSpaceTitle.appendChild(span);

    if (index < path.length - 1) {
      const sep = document.createElement("span");
      sep.textContent = "/";
      sep.className = "breadcrumb-separator";
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
      const title = path ? `${path} / ${node.title}` : node.title;
      folders.push({ folder: node, title: title, items: node.children || [] });

      if (node.children) {
        folders = folders.concat(flattenFolders(node.children, title));
      }
    }
  });

  return folders;
}

function renderCollections(nodes, spaceTitle = "") {
  elements.collectionsContainer.replaceChildren();

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
    renderCollectionRow(f.title, directItems, f.folder);
    collectionsCount++;
  });

  elements.collectionCount.textContent = `${collectionsCount} colecciones`;

  if (collectionsCount === 0) {
    elements.collectionsContainer.innerHTML =
      "<p class='empty-state'>Esta carpeta está vacía.</p>";
  }
}

function renderCollectionRow(title, items, folderNode = null) {
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
  titleEl.innerHTML = `${title} <span style="color:var(--text-muted);font-size:14px;font-weight:normal;margin-left:8px;">(${items.length})</span>`;

  headerLeft.appendChild(toggleBtn);
  headerLeft.appendChild(titleEl);
  header.appendChild(headerLeft);

  if (folderNode && folderNode.id !== state.currentSpaceId) {
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
    items.forEach((item) => {
      cardsContainer.appendChild(createCard(item));
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

function createCard(node) {
  const isFolder = !node.url;
  const card = document.createElement(isFolder ? "div" : "a");
  card.className = "bookmark-card";

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
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
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
  title.textContent =
    node.title || (isFolder ? "Carpeta sin nombre" : "Enlace sin nombre");

  header.appendChild(iconContainer);
  header.appendChild(title);
  card.appendChild(header);

  if (!isFolder) {
    const urlText = document.createElement("div");
    urlText.className = "card-url";
    try {
      urlText.textContent = new URL(node.url).hostname;
    } catch {
      urlText.textContent = node.url;
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

  return card;
}

function setupSearch() {
  elements.searchInput.addEventListener("input", async (e) => {
    const query = e.target.value.trim().toLowerCase();

    if (!query) {
      // Reset view to current space
      const currentSpace = state.rootFolders.find(
        (f) => f.id === state.currentSpaceId,
      );
      if (currentSpace) {
        selectSpace(currentSpace);
      }
      return;
    }

    // Search bookmarks
    try {
      const results = await chrome.bookmarks.search(query);
      elements.currentSpaceTitle.textContent = "Resultados de búsqueda";

      // We can group results by folder or just show a flat list. Let's do a single list for simplicity.
      elements.collectionsContainer.replaceChildren();
      if (results.length === 0) {
        elements.collectionsContainer.innerHTML =
          "<p class='empty-state'>No se encontraron resultados.</p>";
        elements.collectionCount.textContent = "0 resultados";
      } else {
        renderCollectionRow(`Resultados para "${query}"`, results);
        elements.collectionCount.textContent = `${results.length} resultados`;
      }
    } catch (e) {
      console.error(e);
    }
  });
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
  } else {
    elements.cmOpenNew.style.display = "block";
  }
}

function setupContextMenu() {
  // Ocultar al hacer clic fuera
  document.addEventListener("click", () => {
    elements.contextMenu.classList.add("hidden");
  });

  elements.cmOpenNew.addEventListener("click", () => {
    if (state.contextNode && state.contextNode.url) {
      chrome.tabs.create({ url: state.contextNode.url });
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
