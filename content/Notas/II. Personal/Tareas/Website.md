---

---

- Change font to --font-sans:
    - search bar
    - graph
    - footer (bakclinks, interactive graph)
    - right side bar (table of contents)

- when the name of the page appear at the page's beginning, make it of the default text color, not red.

- Make the top 2 folders (I. Ciencia, II. Personal) always expanded

- right side bar (table of contents):
    - Remove the scroll bar, while still keeping the list scrollable
    - make the page title be displayed on top

- The left side bar cuts off at the top of the screen. Fix it (it should be full page height like on the page "1. Etnomusicología").

- The "Pin" icon:
    - replace the icon with a vertical single bar (ensure it looks professional and modern),
    - make bigger, 
    - when the side bar expands, make it quickly but smoothly migrate to inside the side bar.

- move the "Home" button (the network icon) and the search bar to the left side bar (for all pages).

- remove the top bar from all pages altogether, so that the rest of the website layout could move up

---

- make the .md page items foldable like in the Obsidian (see the screenshot) and the VS Code editor
![alt text]({2AFD7144-7A4F-4B29-9A26-CFD8C9D7AF2C}.png)

---

- Prevent the text labels on the globe from overlapping, while placing each one in its most appropriate location on the globe.

- Exclude French Guiana from the Mediterráneo region.

---

- page "7. Música":
  - Make the links appear like 2 columns of tabs with 
    - corresponding minimalistic icons (from Google Material Symbols), 
    - --font-sans,
  - move the "backlinks" section to the right side, and make it hideable (foldable)
  - Interactive Graph:
    - remove border (make it appear seamless like on the Home page)
    - make it full page right below the link tabs (similar to liek it is on the Home page, but with the tabs above)

- Page "Laudería":
  - row 1 — Woodworking symbol, row 2 — piano, violin, guitar symbols, row 3 — aerófonos symbol.

---

- Style the graph like in the lastest version of Obsidian.

- Can you add a menu interface controlling the graph on the Home page, like the Obsidian has (see the screenshot)? ![alt text]({CE2322B8-B1BA-488E-85B8-572211DB264A}.png)

---

- Create a new page in the folder "II. Personal". Make it a reading tracker similar to what I have on Google Sheets (see the screenshot):
1. books sorted by categories and subcategories (that mirror my "I. Ciencia" folder and subfolders) 
2. columns: 
   1. Ciencia (area)
   2. Subarea
   3. Author
   4. Title
   5. Chapter
   6. Year
   7. Timing (dates):
      1. start
      2. end
   8. pages:
      1. current (make it editable, so I could easily update it)
      2. total
      3. Progress bar + percentage text overlayed on top of the bar
3. color each category according to its color in the graph.
4. total read books (overall and per category).
5. copy this book list: "D:\Downloads\Tareas.xlsx"
![alt text](image.png)

---

- make images on the website clickable to expand to full screen

---

- copy the globe to the page "4. Historia", but adapt its countries / links to the folders and files inside the "4. Historia" folder.
- instead of the modern post-Soviet countries, make the USSR appear on the globe

---

- This repository got too complex. Optimize it carefully, so that nothing breaks. 

    - remove reduntant and unused files, folders. (don't edit the "content/Notas" folder)

    - is it possible to merge certain files, so that editing and controlling various elements of the website would be from a single place? E.g., 
      - the graph appearance (font, colors, background,etc.) is controlled from one file, 
      - the globe layout (positions, etc.) is controlled from another file, 
      - the Markdown rendering (colors, etc.) is controlled from another file, 
      - etc.

    - go through all files (especially .scss), and optimize and clean them up: delete reduntant code, order the code blocks logically, group lines visually where possible, etc.

    - remove unnecessary comments, like commented-out code blocks.

    - add clear, concise comments to the .scss files in the "assets" folder.

---

- How to color the folders in the left side bar and in the reading tracker according to their color in the graph? So that I could control the colors from a single place.

---

- Is it possible to add at least a simple text editor to the pages that are rendered from .md files?
- How to create a "Live Preview" mode (like the Obsidian has) for .md inside VS Code or the website?

---

- shortcuts in the bottom bar of VS Code
  - "Serve & Open": 
    - if the website is already running, make it stop, and then serve again
    - remove the "Open" option
  - add a shortcut that resets the repository to the last commit (git reset --hard HEAD)