@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
set "PNPM_EXE="

where node >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%I in ('where node') do (
    if not defined NODE_EXE set "NODE_EXE=%%I"
  )
)

if not defined NODE_EXE (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  )
)

if not defined NODE_EXE (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js LTS em https://nodejs.org/ ou execute este projeto pelo Codex.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" (
    set "PNPM_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
  )

  if not defined PNPM_EXE (
    echo ERRO: As dependencias nao estao instaladas e o pnpm nao foi encontrado.
    echo Instale o Node.js LTS e execute npm install nesta pasta.
    pause
    exit /b 1
  )

  echo Instalando as dependencias do site...
  call "%PNPM_EXE%" install
  if errorlevel 1 (
    echo ERRO: Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

echo Iniciando o site Origem Certa com MongoDB...
echo Endereco: http://127.0.0.1:5500
echo Para encerrar, pressione Ctrl+C.
echo.

"%NODE_EXE%" server.cjs

if errorlevel 1 (
  echo.
  echo O servidor foi encerrado com erro.
  pause
)

endlocal
