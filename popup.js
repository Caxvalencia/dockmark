"use strict";

const ROOT_ID = "0";
const ROOT_CRUMB = Object.freeze({ id: ROOT_ID, title: "Raíz" });
const ICONS = Object.freeze({
  folder: "📂",
  bookmark: "🔗"
});

const state = {
  currentFolderId: ROOT_ID,
  path: [ROOT_CRUMB],
  requestId: 0
};

const gridElement = document.querySelector("#bookmark-grid");
const breadcrumbsElement = document.querySelector("#breadcrumbs");
const statusElement = document.querySelector("#status");

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  renderBreadcrumbs();
  attachBookmarkListeners();
  await navigateTo(ROOT_ID, [ROOT_CRUMB]);
}

async function navigateTo(folderId, path) {
  const requestId = ++state.requestId;
  setLoadingState();

  try {
    const [folder] = await chrome.bookmarks.getSubTree(folderId);

    if (requestId !== state.requestId) {
      return;
    }

    if (!folder) {
      throw new Error("La carpeta no existe.");
    }

    state.currentFolderId = folderId;
    state.path = path;
    renderBreadcrumbs();
    renderGrid(folder.children || []);
  } catch (error) {
    if (requestId !== state.requestId) {
      return;
    }

    if (folderId !== ROOT_ID) {
      await navigateTo(ROOT_ID, [ROOT_CRUMB]);
      return;
    }

    gridElement.setAttribute("aria-busy", "false");
    showStatus("No se pudieron cargar tus marcadores.", true);
  }
}

function renderBreadcrumbs() {
  const fragment = document.createDocumentFragment();

  state.path.forEach((item, index) => {
    const listItem = document.createElement("li");
    listItem.className = "breadcrumb-item";

    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = "›";
      separator.setAttribute("aria-hidden", "true");
      listItem.append(separator);
    }

    const button = document.createElement("button");
    const isCurrentFolder = index === state.path.length - 1;

    button.type = "button";
    button.className = "breadcrumb-button";
    button.textContent = item.title;
    button.disabled = isCurrentFolder;

    if (isCurrentFolder) {
      button.setAttribute("aria-current", "page");
    } else {
      button.addEventListener("click", () => {
        navigateTo(item.id, state.path.slice(0, index + 1));
      });
    }

    listItem.append(button);
    fragment.append(listItem);
  });

  breadcrumbsElement.replaceChildren(fragment);
}

function renderGrid(nodes) {
  const fragment = document.createDocumentFragment();

  hideStatus();
  gridElement.setAttribute("aria-busy", "false");

  if (nodes.length === 0) {
    gridElement.replaceChildren();
    showStatus("Esta carpeta está vacía.");
    return;
  }

  nodes.forEach((node) => {
    fragment.append(createCard(node));
  });

  gridElement.replaceChildren(fragment);
}

function createCard(node) {
  const isFolder = !node.url;
  const title = getDisplayTitle(node, isFolder);
  const card = document.createElement("button");
  const icon = document.createElement("span");
  const name = document.createElement("span");

  card.type = "button";
  card.className = "bookmark-card";
  card.title = isFolder
    ? `${title}\nDoble clic para abrir la carpeta`
    : title;
  card.setAttribute(
    "aria-label",
    isFolder ? `Carpeta ${title}. Doble clic para abrir.` : `Abrir ${title}`
  );

  icon.className = "card-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = isFolder ? ICONS.folder : ICONS.bookmark;

  name.className = "card-title";
  name.textContent = title;

  card.append(icon, name);

  if (isFolder) {
    card.addEventListener("click", () => selectCard(card));
    card.addEventListener("dblclick", () => {
      navigateTo(node.id, [...state.path, { id: node.id, title }]);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        navigateTo(node.id, [...state.path, { id: node.id, title }]);
      }
    });
  } else {
    card.addEventListener("click", () => openBookmark(node.url));
  }

  return card;
}

function selectCard(selectedCard) {
  gridElement.querySelectorAll(".bookmark-card.is-selected").forEach((card) => {
    card.classList.remove("is-selected");
  });
  selectedCard.classList.add("is-selected");
}

async function openBookmark(url) {
  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    showStatus("No se pudo abrir este marcador.", true);
  }
}

function getDisplayTitle(node, isFolder) {
  if (node.title && node.title.trim()) {
    return node.title.trim();
  }

  if (isFolder) {
    return "Carpeta sin nombre";
  }

  try {
    return new URL(node.url).hostname || "Enlace sin nombre";
  } catch (error) {
    return "Enlace sin nombre";
  }
}

function setLoadingState() {
  gridElement.replaceChildren();
  gridElement.setAttribute("aria-busy", "true");
  showStatus("Cargando marcadores...");
}

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
  statusElement.hidden = false;
}

function hideStatus() {
  statusElement.textContent = "";
  statusElement.classList.remove("error");
  statusElement.hidden = true;
}

function attachBookmarkListeners() {
  const updateEvents = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded
  ];

  updateEvents.forEach((event) => {
    event.addListener(() => {
      navigateTo(state.currentFolderId, state.path);
    });
  });
}
