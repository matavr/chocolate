@echo off
chcp 65001 > nul
title CHOCOLATE WHITE - Boutique Server
echo ====================================================
echo   Запуск сервера CHOCOLATE WHITE...
echo ====================================================
echo.
echo Сайт доступен по адресу: http://localhost:3000
echo Админ-панель:            http://localhost:3000/admin.html
echo.
start http://localhost:3000
node server.js
pause
