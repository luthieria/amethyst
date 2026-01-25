@echo off
echo Cleaning Hugo artifacts...
rmdir /s /q public 2>nul
rmdir /s /q resources 2>nul

echo Generating Quartz indices...
hugo-obsidian -input=content -output=assets/indices -index -root=.

echo Starting Hugo server...
hugo server -D --disableFastRender --ignoreCache
pause