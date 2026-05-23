# DockMark

DockMark es una extensión moderna para Google Chrome diseñada para transformar tu página de "Nueva Pestaña" en un organizador visual de marcadores potente y elegante.

## Características Principales

- **Diseño Moderno y Oscuro:** Disfruta de un tema oscuro amigable con la vista que organiza tus marcadores en espacios y colecciones.
- **Colecciones Visuales:** Todos tus marcadores se agrupan en colecciones horizontales, facilitando encontrar rápidamente lo que necesitas.
- **Navegación Plana:** No te pierdas en menús interminables; las subcarpetas se exponen automáticamente como colecciones en tu vista principal.
- **Arrastrar y Soltar (Drag & Drop):** Reorganiza tus enlaces moviendo las tarjetas a diferentes colecciones o carpetas fácilmente.
- **Gestión Directa:**
  - Crea nuevas colecciones rápidamente.
  - Renombra carpetas directamente haciendo clic en el ícono del lápiz o desde el menú contextual.
  - Elimina o edita enlaces sin tener que abrir el administrador nativo de Chrome.
- **Buscador Integrado:** Filtra y encuentra rápidamente los enlaces que buscas desde la barra lateral.

## Instalación (Modo Desarrollador)

1. Clona o descarga este repositorio en tu computadora.
2. Abre Google Chrome y ve a `chrome://extensions/`.
3. Activa el **Modo de desarrollador** (Developer mode) en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** (Load unpacked) y selecciona la carpeta del proyecto.
5. Abre una **nueva pestaña** y disfruta de DockMark.

## Estructura del Proyecto

- `manifest.json`: Configuración principal de la extensión, permisos e íconos.
- `newtab.html / .css / .js`: El núcleo de DockMark, reemplaza la nueva pestaña predeterminada y renderiza la interfaz.
- `popup.html / .css / .js`: La ventana emergente tradicional al hacer clic en el ícono de la extensión.
- `assets/`: Contiene el logotipo y los íconos del proyecto en múltiples resoluciones.
