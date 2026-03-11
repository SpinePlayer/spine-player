#!/usr/bin/env bash

set -euo pipefail

# 颜色输出帮助函数
function info()  { echo -e "\033[32m[INFO]\033[0m  $1"; }

# 取消发布某个版本，如果有bug，可以先取消发布，再重新发布
npm_registry="https://registry.npmjs.org/"

npm unpublish spine-web-player@4.2.2 --force --registry=$npm_registry
info "取消发布完成！"
